import { fetchAllActiveListings, fetchItemSpecifics } from "@/lib/ebay/trading";
import { createServiceClient } from "@/lib/supabase/server";
import { saveEbayConfig } from "@/lib/ebay/auth";
import { slugify } from "@/lib/utils";
import { revalidateTag } from "next/cache";
import type { EbayConfig } from "@/types";

export interface ListingSyncError {
  listingId: string;
  title: string;
  reason: string;
}

export interface ListingSyncResult {
  total: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: ListingSyncError[];
}

export interface ListingSyncCallbacks {
  onFetching?: () => void | Promise<void>;
  onEnriching?: (current: number, count: number) => void | Promise<void>;
  onTotal?: (total: number) => void | Promise<void>;
  onItem?: (
    current: number,
    total: number,
    title: string,
    status: "inserted" | "updated" | "unchanged" | "skipped",
    reason?: string,
  ) => void | Promise<void>;
}

export async function runEbayListingSync(
  config: EbayConfig,
  callbacks?: ListingSyncCallbacks,
): Promise<ListingSyncResult> {
  const supabase = createServiceClient();

  const { data: cats, error: catErr } = await supabase
    .from("categories")
    .select("id, name, slug, parent_id, ebay_category_id");

  if (catErr) throw new Error(catErr.message);

  const ebayCatMap  = new Map<string, (typeof cats)[number]>();
  const childrenMap = new Map<string, (typeof cats)[number][]>();

  for (const cat of cats ?? []) {
    if (cat.ebay_category_id) ebayCatMap.set(cat.ebay_category_id, cat);
    if (cat.parent_id) {
      const siblings = childrenMap.get(cat.parent_id) ?? [];
      siblings.push(cat);
      childrenMap.set(cat.parent_id, siblings);
    }
  }

  await callbacks?.onFetching?.();
  const listings = await fetchAllActiveListings(config);

  // Enrich only listings in parent categories that need brand routing
  const needsSpecifics = listings.filter((l) => {
    const cat = ebayCatMap.get(l.ebayCategoryId);
    return cat && childrenMap.has(cat.id);
  });

  const enrichTotal  = needsSpecifics.length;
  const ENRICH_BATCH = 8;
  let   enrichedCount = 0;
  await callbacks?.onEnriching?.(0, enrichTotal);

  for (let start = 0; start < needsSpecifics.length; start += ENRICH_BATCH) {
    const batch = needsSpecifics.slice(start, start + ENRICH_BATCH);
    await Promise.all(batch.map(async (listing) => {
      try {
        const { specifics } = await fetchItemSpecifics(listing.listingId, config);
        listing.specifics = specifics;
        listing.brand     = specifics["brand"] ?? specifics["publisher"] ?? null;
      } catch { /* ignore — brand stays null */ }
      enrichedCount++;
      await callbacks?.onEnriching?.(enrichedCount, enrichTotal);
    }));
  }

  const total       = listings.length;
  const discountPct = config.price_discount_percent ?? 0;
  await callbacks?.onTotal?.(total);

  // One bulk lookup to keep slugs stable and enable change detection
  const { data: existingRows } = await supabase
    .from("products")
    .select("id, slug, ebay_listing_id, name, price, inventory, images, description, category_id, weight_oz, length_in, width_in, height_in, genre, grade, professional_grader, certification_number, signed, signed_by")
    .not("ebay_listing_id", "is", null);

  const existingByListingId = new Map(
    (existingRows ?? []).map((p) => [p.ebay_listing_id as string, p]),
  );

  let inserted = 0;
  let updated  = 0;
  let unchanged = 0;
  const errors: ListingSyncError[] = [];

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];

    const matchedCat = ebayCatMap.get(listing.ebayCategoryId);
    if (!matchedCat) {
      const reason = `No website category mapped to eBay category ${listing.ebayCategoryId}`;
      errors.push({ listingId: listing.listingId, title: listing.title, reason });
      await callbacks?.onItem?.(i + 1, total, listing.title, "skipped", reason);
      continue;
    }

    let categoryId = matchedCat.id;
    const children = childrenMap.get(matchedCat.id) ?? [];
    if (children.length > 0 && listing.brand) {
      const brandLower = listing.brand.toLowerCase();
      const brandChild = children.find((c) => c.name.toLowerCase() === brandLower);
      if (brandChild) categoryId = brandChild.id;
    }

    const existing = existingByListingId.get(listing.listingId);
    const now      = new Date().toISOString();
    const slug     = existing?.slug
      ?? `${slugify(listing.title).slice(0, 200)}-${listing.listingId.slice(-6)}`;

    const newPrice = discountPct > 0
      ? Math.round(listing.price * (1 - discountPct / 100) * 100) / 100
      : listing.price;

    if (existing) {
      const newSigned = listing.specifics["signed"] != null
        ? listing.specifics["signed"].toLowerCase() === "yes"
        : null;

      const hasChanged =
        existing.name              !== listing.title ||
        Math.abs(Number(existing.price) - newPrice) >= 0.01 ||
        existing.inventory         !== listing.inventory ||
        JSON.stringify(existing.images) !== JSON.stringify(listing.images) ||
        (existing.description ?? null) !== (listing.description ?? null) ||
        existing.category_id       !== categoryId ||
        existing.weight_oz         !== listing.weightOz ||
        existing.length_in         !== listing.lengthIn ||
        existing.width_in          !== listing.widthIn ||
        existing.height_in         !== listing.heightIn ||
        (existing.genre            ?? null) !== (listing.specifics["genre"]                ?? null) ||
        (existing.grade            ?? null) !== (listing.specifics["grade"]                ?? null) ||
        (existing.professional_grader ?? null) !== (listing.specifics["professional grader"] ?? null) ||
        (existing.certification_number ?? null) !== (listing.specifics["certification number"] ?? null) ||
        (existing.signed           ?? null) !== newSigned ||
        (existing.signed_by        ?? null) !== (listing.specifics["signed by"]            ?? null);

      if (!hasChanged) {
        unchanged++;
        await callbacks?.onItem?.(i + 1, total, listing.title, "unchanged");
        continue;
      }
    }

    const { error } = await supabase
      .from("products")
      .upsert(
        {
          ...(existing ? { id: existing.id } : {}),
          ebay_listing_id:      listing.listingId,
          name:                 listing.title,
          slug,
          description:          listing.description,
          price:                newPrice,
          cost:                 0,
          inventory:            listing.inventory,
          images:               listing.images,
          category_id:          categoryId,
          weight_oz:            listing.weightOz,
          length_in:            listing.lengthIn,
          width_in:             listing.widthIn,
          height_in:            listing.heightIn,
          is_published:         true,
          genre:                listing.specifics["genre"]                    ?? null,
          grade:                listing.specifics["grade"]                    ?? null,
          professional_grader:  listing.specifics["professional grader"]      ?? null,
          certification_number: listing.specifics["certification number"]     ?? null,
          signed:               listing.specifics["signed"] != null
            ? listing.specifics["signed"].toLowerCase() === "yes"
            : null,
          signed_by:            listing.specifics["signed by"]                ?? null,
          updated_at:           now,
        },
        { onConflict: "ebay_listing_id" },
      );

    if (error) {
      errors.push({ listingId: listing.listingId, title: listing.title, reason: error.message });
      await callbacks?.onItem?.(i + 1, total, listing.title, "skipped", error.message);
    } else if (existing) {
      updated++;
      await callbacks?.onItem?.(i + 1, total, listing.title, "updated");
    } else {
      inserted++;
      await callbacks?.onItem?.(i + 1, total, listing.title, "inserted");
    }
  }

  await saveEbayConfig({
    listings_synced_at: new Date().toISOString(),
    listings_count:     inserted + updated + unchanged,
  } as any);

  if (inserted > 0 || updated > 0) {
    revalidateTag("products", "default");
  }

  return { total, inserted, updated, unchanged, errors };
}
