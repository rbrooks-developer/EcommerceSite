import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEbayConfig, saveEbayConfig } from "@/lib/ebay/auth";
import { fetchAllActiveListings } from "@/lib/ebay/trading";
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
      const config = await getEbayConfig();
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
      const total    = listings.length;
      await send({ type: "total", count: total });

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

        // Brand → child category routing
        let categoryId    = matchedCat.id;
        let resolvedChild: string | null = null;
        const children    = childrenMap.get(matchedCat.id) ?? [];
        if (children.length > 0 && listing.brand) {
          const brandLower = listing.brand.toLowerCase();
          const brandChild = children.find((c) => c.name.toLowerCase() === brandLower);
          if (brandChild) { categoryId = brandChild.id; resolvedChild = brandChild.name; }
        }

        // Check for existing product
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("ebay_listing_id", listing.listingId)
          .maybeSingle();

        const now = new Date().toISOString();

        if (existing) {
          const { error } = await supabase
            .from("products")
            .update({
              name:        listing.title,
              description: listing.description,
              price:       listing.price,
              cost:        0,
              inventory:   listing.inventory,
              images:      listing.images,
              category_id: categoryId,
              weight_oz:   listing.weightOz,
              length_in:   listing.lengthIn,
              width_in:    listing.widthIn,
              height_in:   listing.heightIn,
              is_published: true,
              updated_at:  now,
            })
            .eq("id", existing.id);

          const debug = {
            brand:          listing.brand,
            specifics:      listing.specifics,
            parentCategory: matchedCat.name,
            childCategory:  resolvedChild,
          };

          if (error) {
            errors.push({ listingId: listing.listingId, title: listing.title, reason: error.message });
            await send({ type: "item", current: i + 1, total, title: listing.title, status: "skipped", reason: error.message, ...debug });
          } else {
            updated++;
            await send({ type: "item", current: i + 1, total, title: listing.title, status: "updated", ...debug });
          }
        } else {
          const slug = `${slugify(listing.title).slice(0, 200)}-${listing.listingId.slice(-6)}`;

          const debug = {
            brand:          listing.brand,
            specifics:      listing.specifics,
            parentCategory: matchedCat.name,
            childCategory:  resolvedChild,
          };

          const { error } = await supabase
            .from("products")
            .insert({
              name:            listing.title,
              slug,
              description:     listing.description,
              price:           listing.price,
              cost:            0,
              inventory:       listing.inventory,
              images:          listing.images,
              category_id:     categoryId,
              weight_oz:       listing.weightOz,
              length_in:       listing.lengthIn,
              width_in:        listing.widthIn,
              height_in:       listing.heightIn,
              is_published:    true,
              ebay_listing_id: listing.listingId,
            });

          if (error) {
            errors.push({ listingId: listing.listingId, title: listing.title, reason: error.message });
            await send({ type: "item", current: i + 1, total, title: listing.title, status: "skipped", reason: error.message, ...debug });
          } else {
            inserted++;
            await send({ type: "item", current: i + 1, total, title: listing.title, status: "inserted", ...debug });
          }
        }
      }

      await saveEbayConfig({
        listings_synced_at: new Date().toISOString(),
        listings_count:     inserted + updated,
      } as any);

      await send({ type: "done", inserted, updated, errors });
    } catch (err) {
      await send({ type: "fatal", message: (err as Error).message ?? "Sync failed" });
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
