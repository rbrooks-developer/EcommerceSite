import { fetchAllActiveListings } from "@/lib/ebay/trading";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidateTag } from "next/cache";
import type { EbayConfig } from "@/types";

export interface InventorySyncResult {
  total: number;
  updated: number;
  zeroed: number;
  unchanged: number;
  errors: number;
}

export interface InventorySyncItemProgress {
  current: number;
  total: number;
  title: string;
  status: "updated" | "zeroed" | "unchanged" | "error";
}

export interface InventorySyncCallbacks {
  onTotal?: (total: number) => void | Promise<void>;
  onItem?: (progress: InventorySyncItemProgress) => void | Promise<void>;
}

/**
 * Pulls every active listing from eBay in one paginated GetSellerList call
 * and reconciles local inventory and price against it. Only writes to the DB
 * when inventory or price actually changed.
 */
export async function runEbayInventorySync(
  config: EbayConfig,
  callbacks?: InventorySyncCallbacks,
): Promise<InventorySyncResult> {
  const supabase = createServiceClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, inventory, price, ebay_listing_id")
    .not("ebay_listing_id", "is", null);

  const items = (products ?? []) as {
    id: string; name: string; inventory: number; price: number; ebay_listing_id: string;
  }[];

  await callbacks?.onTotal?.(items.length);

  const activeListings = await fetchAllActiveListings(config);
  const listingById = new Map(activeListings.map((l) => [l.listingId, l]));

  const discountPct = config.price_discount_percent ?? 0;

  let updated = 0, zeroed = 0, unchanged = 0, errors = 0;

  for (let i = 0; i < items.length; i++) {
    const product = items[i];
    try {
      const listing = listingById.get(product.ebay_listing_id) ?? null;

      let status: InventorySyncItemProgress["status"];

      if (listing === null) {
        // Listing ended or was deleted — zero inventory, leave price alone
        if (product.inventory !== 0) {
          await supabase.from("products").update({ inventory: 0 }).eq("id", product.id);
          zeroed++;
          status = "zeroed";
        } else {
          unchanged++;
          status = "unchanged";
        }
      } else {
        const newInventory = listing.inventory;
        const newPrice = discountPct > 0
          ? Math.round(listing.price * (1 - discountPct / 100) * 100) / 100
          : listing.price;

        const inventoryChanged = newInventory !== product.inventory;
        const priceChanged = Math.abs(newPrice - product.price) >= 0.01;

        if (inventoryChanged || priceChanged) {
          const patch: Record<string, number> = {};
          if (inventoryChanged) patch.inventory = newInventory;
          if (priceChanged)     patch.price     = newPrice;
          await supabase.from("products").update(patch).eq("id", product.id);
          updated++;
          status = "updated";
        } else {
          unchanged++;
          status = "unchanged";
        }
      }

      await callbacks?.onItem?.({ current: i + 1, total: items.length, title: product.name, status });
    } catch (err: any) {
      errors++;
      console.error(`[ebay-inv-sync] error on ${product.ebay_listing_id}:`, err.message);
      await callbacks?.onItem?.({ current: i + 1, total: items.length, title: product.name, status: "error" });
    }
  }

  if (updated > 0 || zeroed > 0) {
    revalidateTag("products", "default");
  }

  return { total: items.length, updated, zeroed, unchanged, errors };
}
