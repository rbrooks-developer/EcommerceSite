import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEbayConfig, saveEbayConfig } from "@/lib/ebay/auth";
import { fetchAllActiveListings } from "@/lib/ebay/trading";
import { createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export const dynamic    = "force-dynamic";
export const maxDuration = 300;

export interface SyncError {
  listingId: string;
  title:     string;
  reason:    string;
}

export interface SyncResult {
  synced:   number;
  updated:  number;
  inserted: number;
  errors:   SyncError[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const config = await getEbayConfig();
    if (!config?.access_token) {
      return NextResponse.json({ error: "eBay account not connected" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ── Load all website categories ──────────────────────────────────────────
    const { data: cats, error: catErr } = await supabase
      .from("categories")
      .select("id, name, slug, parent_id, ebay_category_id");

    if (catErr) return NextResponse.json({ error: catErr.message }, { status: 500 });

    // ebay_category_id → category row
    const ebayCatMap = new Map<string, typeof cats[number]>();
    // parent category id → array of child category rows
    const childrenMap = new Map<string, typeof cats[number][]>();

    for (const cat of cats ?? []) {
      if (cat.ebay_category_id) ebayCatMap.set(cat.ebay_category_id, cat);
      if (cat.parent_id) {
        const siblings = childrenMap.get(cat.parent_id) ?? [];
        siblings.push(cat);
        childrenMap.set(cat.parent_id, siblings);
      }
    }

    // ── Fetch all active eBay listings ───────────────────────────────────────
    const listings = await fetchAllActiveListings(config);

    // ── Upsert loop ──────────────────────────────────────────────────────────
    let inserted = 0;
    let updated  = 0;
    const errors: SyncError[] = [];

    for (const listing of listings) {
      // 1. Match to a website category via ebay_category_id
      const matchedCat = ebayCatMap.get(listing.ebayCategoryId);
      if (!matchedCat) {
        errors.push({
          listingId: listing.listingId,
          title:     listing.title,
          reason:    `No website category is mapped to eBay category ID ${listing.ebayCategoryId}`,
        });
        continue;
      }

      // 2. If the matched category has children and the listing has a Brand,
      //    try to route to the child whose name matches the Brand.
      let categoryId = matchedCat.id;
      const children = childrenMap.get(matchedCat.id) ?? [];
      if (children.length > 0 && listing.brand) {
        const brandLower = listing.brand.toLowerCase();
        const brandChild = children.find(
          (c) => c.name.toLowerCase() === brandLower
        );
        if (brandChild) categoryId = brandChild.id;
      }

      // 3. Check for an existing product with this eBay listing ID
      const { data: existing } = await supabase
        .from("products")
        .select("id, slug")
        .eq("ebay_listing_id", listing.listingId)
        .maybeSingle();

      const now = new Date().toISOString();

      if (existing) {
        // UPDATE — preserve id, slug, created_at
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

        if (error) {
          errors.push({ listingId: listing.listingId, title: listing.title, reason: error.message });
        } else {
          updated++;
        }
      } else {
        // INSERT — generate a unique slug: slugified title + last 6 digits of listing ID
        const slug = `${slugify(listing.title).slice(0, 200)}-${listing.listingId.slice(-6)}`;

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
        } else {
          inserted++;
        }
      }
    }

    const result: SyncResult = {
      synced:   inserted + updated,
      inserted,
      updated,
      errors,
    };

    // Persist last-synced timestamp
    await saveEbayConfig({
      listings_synced_at: new Date().toISOString(),
      listings_count:     result.synced,
    } as any);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[ebay/listings/sync]", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Sync failed" },
      { status: 500 }
    );
  }
}
