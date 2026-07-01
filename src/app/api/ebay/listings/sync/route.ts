import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getValidEbayConfig, saveEbayConfig } from "@/lib/ebay/auth";
import { fetchAllActiveListings, fetchItemSpecifics } from "@/lib/ebay/trading";
import { createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

export async function POST(_request: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if (auth.error) {
    return new Response(JSON.stringify({ type: "fatal", message: "Unauthorized" }) + "\n", {
      status: 401,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }

  const encoder = new TextEncoder();
  const stream  = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = stream.writable.getWriter();

  const send = (data: object) =>
    writer.write(encoder.encode(JSON.stringify(data) + "\n"));

  // Run sync in the background so we can return the stream immediately
  (async () => {
    try {
      const config = await getValidEbayConfig();
      if (!config?.access_token) {
        await send({ type: "fatal", message: "eBay account not connected" });
        return;
      }

      const supabase = createServiceClient();

      // Load website categories
      const { data: cats, error: catErr } = await supabase
        .from("categories")
        .select("id, name, slug, parent_id, ebay_category_id");

      if (catErr) {
        await send({ type: "fatal", message: catErr.message });
        return;
      }

      const ebayCatMap = new Map<string, typeof cats[number]>();
      const childrenMap = new Map<string, typeof cats[number][]>();

      for (const cat of cats ?? []) {
        if (cat.ebay_category_id) ebayCatMap.set(cat.ebay_category_id, cat);
        if (cat.parent_id) {
          const siblings = childrenMap.get(cat.parent_id) ?? [];
          siblings.push(cat);
          childrenMap.set(cat.parent_id, siblings);
        }
      }

      // Fetch all active eBay listings
      await send({ type: "fetching" });
      const listings = await fetchAllActiveListings(config);

      // Enrich only listings that go to a category with children — those need
      // brand/publisher from ItemSpecifics for child-category routing.
      // GetSellerList never returns ItemSpecifics, so we call GetItem per listing.
      const needsSpecifics = listings.filter((l) => {
        const cat = ebayCatMap.get(l.ebayCategoryId);
        return cat && childrenMap.has(cat.id);
      });
      // GetItem to fetch ItemSpecifics (Publisher/Brand) for items in parent categories.
      // Many listings have no ItemSpecifics set in eBay, so title keyword matching
      // is used as a fallback (checked during the main loop below).
      // Run in parallel batches to stay well under eBay rate limits while avoiding
      // a fully sequential round-trip per listing.
      const enrichTotal  = needsSpecifics.length;
      const ENRICH_BATCH = 8;
      let enrichedCount  = 0;
      await send({ type: "enriching", current: 0, count: enrichTotal });
      for (let start = 0; start < needsSpecifics.length; start += ENRICH_BATCH) {
        const batch = needsSpecifics.slice(start, start + ENRICH_BATCH);
        await Promise.all(batch.map(async (listing) => {
          try {
            const { specifics } = await fetchItemSpecifics(listing.listingId, config);
            listing.specifics = specifics;
            listing.brand     = specifics["brand"] ?? specifics["publisher"] ?? null;
          } catch {
            // Ignore — brand stays null
          }
          enrichedCount++;
          await send({ type: "enriching", current: enrichedCount, count: enrichTotal });
        }));
      }

      const total       = listings.length;
      const discountPct = config.price_discount_percent ?? 0;
      await send({ type: "total", count: total });

      // One bulk lookup instead of a SELECT per listing — keeps existing slugs
      // stable across syncs (re-deriving a slug from the title on every sync
      // would change public product URLs).
      const { data: existingRows } = await supabase
        .from("products")
        .select("id, slug, ebay_listing_id")
        .not("ebay_listing_id", "is", null);

      const existingByListingId = new Map(
        (existingRows ?? []).map((p) => [p.ebay_listing_id as string, p]),
      );

      let inserted = 0;
      let updated  = 0;
      const errors: { listingId: string; title: string; reason: string }[] = [];

      for (let i = 0; i < listings.length; i++) {
        const listing = listings[i];

        // Match to a website category
        const matchedCat = ebayCatMap.get(listing.ebayCategoryId);
        if (!matchedCat) {
          const reason = `No website category mapped to eBay category ${listing.ebayCategoryId}`;
          errors.push({ listingId: listing.listingId, title: listing.title, reason });
          await send({ type: "item", current: i + 1, total, title: listing.title, status: "skipped", reason });
          continue;
        }

        // Brand → child category routing via ItemSpecifics (Publisher or Brand field)
        let categoryId    = matchedCat.id;
        let resolvedChild: string | null = null;
        const children    = childrenMap.get(matchedCat.id) ?? [];
        if (children.length > 0 && listing.brand) {
          const brandLower = listing.brand.toLowerCase();
          const brandChild = children.find((c) => c.name.toLowerCase() === brandLower);
          if (brandChild) { categoryId = brandChild.id; resolvedChild = brandChild.name; }
        }

        const existing = existingByListingId.get(listing.listingId);
        const now       = new Date().toISOString();
        const slug      = existing?.slug
          ?? `${slugify(listing.title).slice(0, 200)}-${listing.listingId.slice(-6)}`;

        const { error } = await supabase
          .from("products")
          .upsert(
            {
              ...(existing ? { id: existing.id } : {}),
              ebay_listing_id: listing.listingId,
              name:            listing.title,
              slug,
              description:     listing.description,
              price:           discountPct > 0
                ? Math.round(listing.price * (1 - discountPct / 100) * 100) / 100
                : listing.price,
              cost:            0,
              inventory:       listing.inventory,
              images:          listing.images,
              category_id:     categoryId,
              weight_oz:       listing.weightOz,
              length_in:       listing.lengthIn,
              width_in:        listing.widthIn,
              height_in:       listing.heightIn,
              is_published:    true,
              updated_at:      now,
            },
            { onConflict: "ebay_listing_id" },
          );

        if (error) {
          errors.push({ listingId: listing.listingId, title: listing.title, reason: error.message });
          await send({ type: "item", current: i + 1, total, title: listing.title, status: "skipped", reason: error.message });
        } else if (existing) {
          updated++;
          await send({ type: "item", current: i + 1, total, title: listing.title, status: "updated" });
        } else {
          inserted++;
          await send({ type: "item", current: i + 1, total, title: listing.title, status: "inserted" });
        }
      }

      await saveEbayConfig({
        listings_synced_at: new Date().toISOString(),
        listings_count:     inserted + updated,
      } as any);

      await send({ type: "done", inserted, updated, errors });
    } catch (err) {
      const e = err as Error & { cause?: Error };
      const message = [e.message, e.cause?.message].filter(Boolean).join(" → ");
      console.error("[ebay/listings/sync] fatal", message, e.cause ?? e);
      await send({ type: "fatal", message: message || "Sync failed" });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type":  "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no", // disable Nginx buffering on some hosts
    },
  });
}
