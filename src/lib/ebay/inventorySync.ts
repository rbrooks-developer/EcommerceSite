import { XMLParser } from "fast-xml-parser";
import { createServiceClient } from "@/lib/supabase/server";
import type { EbayConfig } from "@/types";

const TRADING_URL         = "https://api.ebay.com/ws/api.dll";
const COMPATIBILITY_LEVEL = "1155";

export interface InventorySyncResult {
  total: number;
  updated: number;
  zeroed: number;
  unchanged: number;
  errors: number;
}

export async function runEbayInventorySync(config: EbayConfig): Promise<InventorySyncResult> {
  const supabase = createServiceClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, inventory, ebay_listing_id")
    .not("ebay_listing_id", "is", null);

  const items = (products ?? []) as {
    id: string; name: string; inventory: number; ebay_listing_id: string;
  }[];

  let updated = 0, zeroed = 0, unchanged = 0, errors = 0;

  for (const product of items) {
    try {
      const ebayQty = await getEbayAvailableQty(product.ebay_listing_id, config);

      if (ebayQty === null) {
        if (product.inventory !== 0) {
          await supabase.from("products").update({ inventory: 0 }).eq("id", product.id);
          console.log(`[ebay-inv-sync] ${product.ebay_listing_id} not found → "${product.name}" set to 0`);
          zeroed++;
        } else {
          unchanged++;
        }
      } else if (ebayQty !== product.inventory) {
        await supabase.from("products").update({ inventory: ebayQty }).eq("id", product.id);
        console.log(`[ebay-inv-sync] "${product.name}": ${product.inventory} → ${ebayQty}`);
        updated++;
      } else {
        unchanged++;
      }
    } catch (err: any) {
      console.error(`[ebay-inv-sync] error on ${product.ebay_listing_id}:`, err.message);
      errors++;
    }
  }

  return { total: items.length, updated, zeroed, unchanged, errors };
}

/**
 * Returns the available quantity for an eBay listing, or null if the listing
 * no longer exists. Returns 0 if the listing exists but is not active.
 */
export async function getEbayAvailableQty(
  listingId: string,
  config: EbayConfig,
): Promise<number | null> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${config.access_token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${listingId}</ItemID>
  <DetailLevel>ItemReturnDescription</DetailLevel>
</GetItemRequest>`;

  const res = await fetch(TRADING_URL, {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": COMPATIBILITY_LEVEL,
      "X-EBAY-API-CALL-NAME":           "GetItem",
      "X-EBAY-API-APP-NAME":            config.app_id,
      "Content-Type":                   "text/xml",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) throw new Error(`GetItem HTTP ${res.status}`);

  const xml    = await res.text();
  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue:    true,
    isArray:          (name) => name === "Errors",
  });
  const doc      = parser.parse(xml);
  const response = doc.GetItemResponse;

  if (response?.Ack === "Failure") {
    const errs: any[] = Array.isArray(response.Errors) ? response.Errors : [response.Errors];
    const notFound = errs.some(
      (e) =>
        String(e?.ErrorCode) === "17" ||
        String(e?.ShortMessage ?? "").toLowerCase().includes("invalid item"),
    );
    if (notFound) return null;
    throw new Error(errs.map((e) => e?.ShortMessage ?? "eBay error").join("; "));
  }

  const totalQty = parseInt(String(response?.Item?.Quantity     ?? 0), 10);
  const soldQty  = parseInt(String(response?.Item?.QuantitySold ?? 0), 10);
  const status   = String(response?.Item?.SellingStatus?.ListingStatus ?? "").toLowerCase();

  if (status !== "active") return 0;
  return Math.max(0, totalQty - soldQty);
}
