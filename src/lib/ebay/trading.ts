import { XMLParser } from "fast-xml-parser";
import type { EbayConfig } from "@/types";

const TRADING_URL         = "https://api.ebay.com/ws/api.dll";
const COMPATIBILITY_LEVEL = "1155";

export interface TradingItem {
  listingId:      string;
  title:          string;
  price:          number;
  inventory:      number;
  description:    string | null;
  images:         string[];
  ebayCategoryId: string;
  brand:          string | null;
  specifics:      Record<string, string>; // all item specifics, normalized lowercase keys
  weightOz:       number;
  lengthIn:       number;
  widthIn:        number;
  heightIn:       number;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseItem(raw: any): TradingItem | null {
  const listingId = String(raw.ItemID ?? "").trim();
  const title     = String(raw.Title ?? "").trim();
  if (!listingId || !title) return null;

  // Price: StartPrice is the fixed price for FixedPriceItem listings
  const price = parseFloat(String(raw.StartPrice ?? 0));
  if (price <= 0) return null;

  // Remaining inventory
  const totalQty = parseInt(String(raw.Quantity ?? 0), 10);
  const soldQty  = parseInt(String(raw.QuantitySold ?? 0), 10);
  const inventory = Math.max(0, totalQty - soldQty);

  // Description — HTML stripped to plain text
  const rawDesc   = String(raw.Description ?? "");
  const description = rawDesc ? stripHtml(rawDesc) : null;

  // Images — always an array thanks to XMLParser isArray config
  const pics: string[] = raw.PictureDetails?.PictureURL ?? [];
  const images = pics.filter(Boolean);

  // eBay primary category
  const ebayCategoryId = String(raw.PrimaryCategory?.CategoryID ?? "").trim();

  // Item specifics — Value can be a string or array (multiple values)
  const nameValueList: { Name: unknown; Value: unknown }[] =
    raw.ItemSpecifics?.NameValueList ?? [];

  // Build a normalized map: lowercase name → first value string
  const specifics: Record<string, string> = {};
  for (const nv of nameValueList) {
    const key = String(nv.Name ?? "").toLowerCase().trim();
    const val = Array.isArray(nv.Value)
      ? String(nv.Value[0] ?? "").trim()
      : String(nv.Value ?? "").trim();
    if (key && val) specifics[key] = val;
  }

  // Comics use "Publisher" instead of "Brand" — check both
  const brand = specifics["brand"] ?? specifics["publisher"] ?? null;

  // Weight: WeightMajor = lbs, WeightMinor = oz
  const weightLbs = parseFloat(String(raw.ShippingPackageDetails?.WeightMajor ?? 0));
  const weightOzPart = parseFloat(String(raw.ShippingPackageDetails?.WeightMinor ?? 0));
  const weightOz  = Math.round(weightLbs * 16 + weightOzPart);

  // Dimensions in inches — default to 0.1 if missing (DB requires > 0)
  const lengthIn = parseFloat(String(raw.ShippingPackageDetails?.PackageLength ?? 0)) || 0.1;
  const widthIn  = parseFloat(String(raw.ShippingPackageDetails?.PackageWidth  ?? 0)) || 0.1;
  const heightIn = parseFloat(String(raw.ShippingPackageDetails?.PackageDepth  ?? 0)) || 0.1;

  return {
    listingId, title, price, inventory, description, images,
    ebayCategoryId, brand, specifics, weightOz, lengthIn, widthIn, heightIn,
  };
}

async function fetchPage(
  config: EbayConfig,
  page: number,
  endTimeFrom: string,
  endTimeTo: string,
): Promise<{ items: TradingItem[]; hasMore: boolean }> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${config.access_token}</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <IncludeSelector>ItemSpecifics</IncludeSelector>
  <EndTimeFrom>${endTimeFrom}</EndTimeFrom>
  <EndTimeTo>${endTimeTo}</EndTimeTo>
  <ListingType>FixedPriceItem</ListingType>
  <Pagination>
    <EntriesPerPage>200</EntriesPerPage>
    <PageNumber>${page}</PageNumber>
  </Pagination>
</GetSellerListRequest>`;

  const res = await fetch(TRADING_URL, {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": COMPATIBILITY_LEVEL,
      "X-EBAY-API-CALL-NAME":           "GetSellerList",
      "X-EBAY-API-APP-NAME":            config.app_id,
      "Content-Type":                   "text/xml",
    },
    body,
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Trading API HTTP ${res.status}`);

  const xml = await res.text();

  const parser = new XMLParser({
    isArray: (name) => ["Item", "PictureURL", "NameValueList"].includes(name),
    ignoreAttributes: true,  // avoids { "#text": val, _attr: ... } wrapping on fields like StartPrice
    parseTagValue:    true,
  });

  const doc      = parser.parse(xml);
  const response = doc.GetSellerListResponse;

  if (!response) throw new Error("Unexpected Trading API response structure");

  const ack = String(response.Ack ?? "");
  if (ack === "Failure") {
    const errs = Array.isArray(response.Errors) ? response.Errors : [response.Errors];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error(errs.map((e: any) => e?.LongMessage ?? e?.ShortMessage).join("; "));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawItems: any[] = response.ItemArray?.Item ?? [];
  const items = rawItems.map(parseItem).filter((x): x is TradingItem => x !== null);

  const hasMore =
    response.HasMoreItems === true ||
    String(response.HasMoreItems).toLowerCase() === "true";

  return { items, hasMore };
}

const SHOPPING_API_URL = "https://open.api.ebay.com/shopping";

/**
 * Shopping API — GetMultipleItems with IncludeSelector=ItemSpecifics.
 * No user token required; returns JSON; max 20 IDs per call.
 * Returns a map of listingId → normalized specifics (lowercase key → first value).
 */
async function fetchSpecificsForIds(
  ids: string[],
  appId: string,
): Promise<Map<string, Record<string, string>>> {
  const url = new URL(SHOPPING_API_URL);
  url.searchParams.set("callname",        "GetMultipleItems");
  url.searchParams.set("version",         "863");
  url.searchParams.set("appid",           appId);
  url.searchParams.set("siteid",          "0");
  url.searchParams.set("ItemID",          ids.join(","));
  url.searchParams.set("IncludeSelector", "ItemSpecifics");
  url.searchParams.set("responseencoding","JSON");

  const res  = await fetch(url.toString(), { signal: AbortSignal.timeout(30_000) });
  const data = await res.json() as any; // eslint-disable-line @typescript-eslint/no-explicit-any

  const map = new Map<string, Record<string, string>>();
  const items: any[] = Array.isArray(data?.Item) ? data.Item : (data?.Item ? [data.Item] : []); // eslint-disable-line @typescript-eslint/no-explicit-any

  for (const item of items) {
    const itemId   = String(item.ItemID ?? "");
    const nvList   = item.ItemSpecifics?.NameValueList;
    const list     = Array.isArray(nvList) ? nvList : (nvList ? [nvList] : []);
    const specifics: Record<string, string> = {};

    for (const nv of list) {
      const key = String(nv.Name ?? "").toLowerCase().trim();
      const val = Array.isArray(nv.Value)
        ? String(nv.Value[0] ?? "").trim()
        : String(nv.Value ?? "").trim();
      if (key && val) specifics[key] = val;
    }
    if (itemId) map.set(itemId, specifics);
  }

  return map;
}

/** Fetches every active Fixed Price listing via the Trading API (paginated),
 *  then enriches each item with ItemSpecifics via the Shopping API. */
export async function fetchAllActiveListings(config: EbayConfig): Promise<TradingItem[]> {
  if (!config.access_token) throw new Error("No eBay access token — connect your account first");

  const now         = new Date();
  const endTimeFrom = now.toISOString();
  const endTimeTo   = new Date(now.getTime() + 120 * 24 * 60 * 60 * 1000).toISOString();

  const all: TradingItem[] = [];
  let page = 1;

  while (true) {
    const { items, hasMore } = await fetchPage(config, page, endTimeFrom, endTimeTo);
    all.push(...items);
    if (!hasMore || page >= 50) break;
    page++;
  }

  // Enrich with ItemSpecifics in batches of 20 via Shopping API
  for (let i = 0; i < all.length; i += 20) {
    const batch   = all.slice(i, i + 20);
    const ids     = batch.map((item) => item.listingId);
    const specMap = await fetchSpecificsForIds(ids, config.app_id);

    for (const item of batch) {
      const specifics = specMap.get(item.listingId) ?? {};
      item.specifics  = specifics;
      item.brand      = specifics["brand"] ?? specifics["publisher"] ?? null;
    }
  }

  return all;
}
