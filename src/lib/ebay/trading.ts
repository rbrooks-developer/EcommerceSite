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
    // Named entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;|&lsquo;|&sbquo;/g, "'")
    .replace(/&rdquo;|&ldquo;|&bdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®")
    .replace(/&trade;/g, "™")
    // Numeric entities (hex and decimal)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
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

  // Remaining inventory — QuantitySold is nested under SellingStatus, not at item root
  const totalQty = parseInt(String(raw.Quantity ?? 0), 10);
  const soldQty  = parseInt(String(raw.SellingStatus?.QuantitySold ?? 0), 10);
  const inventory = Math.max(0, totalQty - soldQty);

  // Description — HTML stripped to plain text
  const rawDesc   = String(raw.Description ?? "");
  const description = rawDesc ? stripHtml(rawDesc) : null;

  // Images — always an array thanks to XMLParser isArray config
  // eBay has two CDN URL formats:
  //   New: …/s-l500.jpg  → swap size token to s-l1600 for full resolution
  //   Old: …/$_12.JPG    → swap size token to $_0 for original resolution
  const pics: string[] = raw.PictureDetails?.PictureURL ?? [];
  const images = pics.filter(Boolean).map((url) =>
    url
      .replace(/s-l\d+(\.(jpg|jpeg|png|webp))/i, "s-l1600$1")
      .replace(/\$_\d+(\.(jpg|jpeg|png))/i, "$$_57$1")
  );

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

/**
 * Trading API — GetItem for a single listing.
 * Returns a normalized specifics map (lowercase key → first value string).
 * Used to get ItemSpecifics which GetSellerList does not return.
 */
export async function fetchItemSpecifics(
  listingId: string,
  config: EbayConfig,
): Promise<{ specifics: Record<string, string> }> {
  const body = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${config.access_token}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${listingId}</ItemID>
  <IncludeItemSpecifics>true</IncludeItemSpecifics>
  <DetailLevel>ReturnAll</DetailLevel>
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
    signal: AbortSignal.timeout(45_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GetItem HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  const xml    = await res.text();
  const parser = new XMLParser({
    isArray:          (name) => ["NameValueList"].includes(name),
    ignoreAttributes: true,
    parseTagValue:    true,
  });

  const doc      = parser.parse(xml);
  const response = doc.GetItemResponse;
  if (response?.Ack === "Failure") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errs = Array.isArray(response.Errors) ? response.Errors : [response.Errors];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error(errs.map((e: any) => e?.LongMessage ?? e?.ShortMessage ?? "eBay error").join("; "));
  }
  const nameValueList: { Name: unknown; Value: unknown }[] =
    response?.Item?.ItemSpecifics?.NameValueList ?? [];

  const specifics: Record<string, string> = {};
  for (const nv of nameValueList) {
    const key = String(nv.Name ?? "").toLowerCase().trim();
    const val = Array.isArray(nv.Value)
      ? String(nv.Value[0] ?? "").trim()
      : String(nv.Value ?? "").trim();
    if (key && val) specifics[key] = val;
  }

  return { specifics };
}

// ── Inventory management helpers ─────────────────────────────────────────────

async function tradingPost(
  callName: string,
  config: EbayConfig,
  xmlBody: string,
): Promise<string> {
  const res = await fetch(TRADING_URL, {
    method: "POST",
    headers: {
      "X-EBAY-API-SITEID":              "0",
      "X-EBAY-API-COMPATIBILITY-LEVEL": COMPATIBILITY_LEVEL,
      "X-EBAY-API-CALL-NAME":           callName,
      "X-EBAY-API-APP-NAME":            config.app_id,
      "Content-Type":                   "text/xml",
    },
    body: xmlBody,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`${callName} HTTP ${res.status}`);
  return res.text();
}

function parseAck(xml: string, responseKey: string): { doc: ReturnType<XMLParser["parse"]>; response: any } {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: true });
  const doc = parser.parse(xml);
  const response = doc[responseKey];
  if (response?.Ack === "Failure") {
    const errs = Array.isArray(response.Errors) ? response.Errors : [response.Errors];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throw new Error(errs.map((e: any) => e?.ShortMessage ?? "eBay error").join("; "));
  }
  return { doc, response };
}

/** Returns current available quantity and whether the listing is still active. */
async function getEbayItemStatus(
  listingId: string,
  config: EbayConfig,
): Promise<{ quantity: number; isActive: boolean }> {
  const xml = await tradingPost("GetItem", config, `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${config.access_token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${listingId}</ItemID>
  <DetailLevel>ItemReturnDescription</DetailLevel>
</GetItemRequest>`);

  const { response } = parseAck(xml, "GetItemResponse");
  const totalQty  = parseInt(String(response?.Item?.Quantity                        ?? 0), 10);
  const soldQty   = parseInt(String(response?.Item?.SellingStatus?.QuantitySold ?? 0), 10);
  const status    = String(response?.Item?.SellingStatus?.ListingStatus ?? "").toLowerCase();
  return { quantity: Math.max(0, totalQty - soldQty), isActive: status === "active" };
}

/**
 * Decrements eBay listing inventory by quantitySold.
 * - Remaining > 0  → ReviseInventoryStatus
 * - Remaining ≤ 0  → EndItem (NotAvailable)
 */
export async function decrementEbayInventory(
  listingId: string,
  quantitySold: number,
  config: EbayConfig,
): Promise<"revised" | "ended"> {
  const { quantity: current, isActive } = await getEbayItemStatus(listingId, config);
  if (!isActive) return "ended"; // already ended — nothing to do

  const next = current - quantitySold;

  if (next > 0) {
    const xml = await tradingPost("ReviseInventoryStatus", config, `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${config.access_token}</eBayAuthToken></RequesterCredentials>
  <InventoryStatus>
    <ItemID>${listingId}</ItemID>
    <Quantity>${next}</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`);
    parseAck(xml, "ReviseInventoryStatusResponse");
    return "revised";
  } else {
    const xml = await tradingPost("EndItem", config, `<?xml version="1.0" encoding="utf-8"?>
<EndItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${config.access_token}</eBayAuthToken></RequesterCredentials>
  <ItemID>${listingId}</ItemID>
  <EndingReason>NotAvailable</EndingReason>
</EndItemRequest>`);
    parseAck(xml, "EndItemResponse");
    return "ended";
  }
}

/**
 * Restores eBay inventory after a refund.
 * - If listing is still active  → ReviseInventoryStatus (add back qty)
 * - If listing was ended         → RelistItem (creates new listing)
 * Returns the listing ID that is now active (may differ from input if relisted).
 */
export async function restoreEbayInventory(
  listingId: string,
  quantityRestored: number,
  config: EbayConfig,
): Promise<{ action: "revised" | "relisted"; activeListingId: string }> {
  const { quantity: current, isActive } = await getEbayItemStatus(listingId, config);

  if (isActive) {
    const xml = await tradingPost("ReviseInventoryStatus", config, `<?xml version="1.0" encoding="utf-8"?>
<ReviseInventoryStatusRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${config.access_token}</eBayAuthToken></RequesterCredentials>
  <InventoryStatus>
    <ItemID>${listingId}</ItemID>
    <Quantity>${current + quantityRestored}</Quantity>
  </InventoryStatus>
</ReviseInventoryStatusRequest>`);
    parseAck(xml, "ReviseInventoryStatusResponse");
    return { action: "revised", activeListingId: listingId };
  } else {
    const xml = await tradingPost("RelistItem", config, `<?xml version="1.0" encoding="utf-8"?>
<RelistItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${config.access_token}</eBayAuthToken></RequesterCredentials>
  <Item>
    <ItemID>${listingId}</ItemID>
    <Quantity>${quantityRestored}</Quantity>
  </Item>
</RelistItemRequest>`);
    const { response } = parseAck(xml, "RelistItemResponse");
    const newListingId = String(response?.ItemID ?? listingId);
    return { action: "relisted", activeListingId: newListingId };
  }
}

/**
 * Registers Platform Notification preferences via Trading API.
 * Sets the delivery URL and enables FixedPriceTransaction, ItemRevised, ItemClosed.
 */
export async function setNotificationPreferences(
  config: EbayConfig,
  endpointUrl: string,
): Promise<void> {
  const xml = await tradingPost("SetNotificationPreferences", config, `<?xml version="1.0" encoding="utf-8"?>
<SetNotificationPreferencesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials><eBayAuthToken>${config.access_token}</eBayAuthToken></RequesterCredentials>
  <ApplicationDeliveryPreferences>
    <ApplicationURL>${endpointUrl}</ApplicationURL>
    <ApplicationEnable>Enable</ApplicationEnable>
    <PayloadVersion>959</PayloadVersion>
  </ApplicationDeliveryPreferences>
  <UserDeliveryPreferenceArray>
    <NotificationEnable>
      <EventType>FixedPriceTransaction</EventType>
      <EventEnable>Enable</EventEnable>
    </NotificationEnable>
    <NotificationEnable>
      <EventType>ItemRevised</EventType>
      <EventEnable>Enable</EventEnable>
    </NotificationEnable>
    <NotificationEnable>
      <EventType>ItemClosed</EventType>
      <EventEnable>Enable</EventEnable>
    </NotificationEnable>
  </UserDeliveryPreferenceArray>
</SetNotificationPreferencesRequest>`);
  parseAck(xml, "SetNotificationPreferencesResponse");
}

/** Fetches every active Fixed Price listing via the Trading API (paginated). */
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

  return all;
}
