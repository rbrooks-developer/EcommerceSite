import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { XMLParser } from "fast-xml-parser";
import { deriveWebhookVerificationToken, recordWebhookHit } from "@/lib/ebay/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { revalidateTag } from "next/cache";

export const dynamic = "force-dynamic";

// ── Challenge verification (Commerce Notification API) ────────────────────────

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const challengeCode = searchParams.get("challenge_code");

  if (!challengeCode) {
    return new Response("OK", { status: 200 });
  }

  const token = deriveWebhookVerificationToken();

  if (!token) {
    console.error("[ebay/notifications] eBay credentials not configured — cannot respond to challenge");
    return new Response("eBay credentials not configured", { status: 500 });
  }

  const endpointUrl = resolveEndpointUrl(request);
  const hash = createHash("sha256")
    .update(challengeCode + token + endpointUrl)
    .digest("hex");

  return Response.json({ challengeResponse: hash });
}

// ── Notification handler ──────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";

  try {
    if (contentType.includes("application/json")) {
      await handleJsonNotification(request);
    } else {
      // Platform Notifications arrive as text/xml or application/xml
      await handleSoapNotification(request);
    }
  } catch (err) {
    console.error("[ebay/notifications] Handler error:", err);
  }

  // Always return 200 — eBay will retry on non-2xx
  return new Response(null, { status: 200 });
}

// ── Commerce Notification API (System A) — JSON ───────────────────────────────

async function handleJsonNotification(request: NextRequest): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const body: any = await request.json();
  const topic: string = body?.metadata?.topic ?? "";

  console.log("[ebay/notifications] Commerce notification:", topic);

  if (topic === "MARKETPLACE_ACCOUNT_DELETION") {
    await handleAccountDeletion(body);
    await recordWebhookHit("MARKETPLACE_ACCOUNT_DELETION");
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAccountDeletion(body: any): Promise<void> {
  const data = body?.notification?.data ?? {};
  const ebayUserId: string  = data.userId    ?? "";
  const ebayUsername: string = data.username ?? "";

  console.log("[ebay/notifications] MARKETPLACE_ACCOUNT_DELETION", { ebayUserId, ebayUsername });

  // Attempt to find and anonymize any matching user data.
  // Our customers authenticate via Supabase email/password — we don't store
  // eBay user IDs for buyers, so this is a best-effort search.
  if (ebayUserId || ebayUsername) {
    const supabase = createServiceClient();

    // Check orders for any billing_name or metadata that matches
    const { data: orders } = await supabase
      .from("orders")
      .select("id, metadata")
      .or(
        [
          ebayUserId   ? `metadata->>ebay_user_id.eq.${ebayUserId}`   : null,
          ebayUsername ? `metadata->>ebay_username.eq.${ebayUsername}` : null,
        ]
          .filter(Boolean)
          .join(",")
      )
      .limit(100);

    if (orders && orders.length > 0) {
      console.log(`[ebay/notifications] Found ${orders.length} order(s) linked to deleted eBay user`);
      // Anonymize by removing personal metadata fields
      for (const order of orders) {
        const meta = (order.metadata ?? {}) as Record<string, unknown>;
        delete meta.ebay_user_id;
        delete meta.ebay_username;
        await supabase.from("orders").update({ metadata: meta } as any).eq("id", order.id);
      }
    }
  }
}

// ── Platform Notifications (System B) — SOAP/XML ─────────────────────────────

async function handleSoapNotification(request: NextRequest): Promise<void> {
  const xml = await request.text();

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue:    true,
    isArray: (name) => ["Transaction", "NotificationEnable"].includes(name),
  });
  const doc = parser.parse(xml);

  const eventName: string = deepFind(doc, "NotificationEventName") ?? "";
  const itemId: string    = String(deepFind(doc, "ItemID") ?? "").trim();

  console.log("[ebay/notifications] Platform notification:", eventName, "ItemID:", itemId);

  if (!eventName) return;

  switch (eventName) {
    case "FixedPriceTransaction":
      await handleFixedPriceTransaction(doc, itemId);
      break;
    case "ItemRevised":
      await handleItemRevised(doc, itemId);
      break;
    case "ItemClosed":
    case "ItemOutOfStock":
      await handleItemClosed(itemId);
      break;
    default:
      console.log("[ebay/notifications] Unhandled event:", eventName);
  }

  await recordWebhookHit(eventName);
}

async function handleFixedPriceTransaction(doc: unknown, itemId: string): Promise<void> {
  if (!itemId) return;

  // QuantityPurchased may be nested inside Transactions.Transaction[0]
  const transactions: unknown[] = deepFind(doc, "Transaction") ?? [];
  const qty = Array.isArray(transactions) && transactions.length > 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? parseInt(String((transactions[0] as any).QuantityPurchased ?? 1), 10)
    : parseInt(String(deepFind(doc, "QuantityPurchased") ?? 1), 10);

  const supabase = createServiceClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, inventory, is_published")
    .eq("ebay_listing_id", itemId)
    .single();

  if (!product) {
    console.log("[ebay/notifications] FixedPriceTransaction: product not found for ItemID", itemId);
    return;
  }

  const newInventory = Math.max(0, (product.inventory ?? 0) - qty);
  const updates: Record<string, unknown> = { inventory: newInventory, updated_at: new Date().toISOString() };
  if (newInventory === 0) updates.is_published = false;

  await supabase.from("products").update(updates as any).eq("id", product.id);
  revalidateTag("products", "default");

  console.log(`[ebay/notifications] FixedPriceTransaction: ItemID ${itemId} inventory ${product.inventory} → ${newInventory}`);
}

async function handleItemRevised(doc: unknown, itemId: string): Promise<void> {
  if (!itemId) return;

  // Extract revised price and inventory from the notification payload
  const startPrice  = parseFloat(String(deepFind(doc, "StartPrice") ?? 0));
  const totalQty    = parseInt(String(deepFind(doc, "Quantity") ?? 0), 10);
  const soldQty     = parseInt(String(deepFind(doc, "QuantitySold") ?? 0), 10);
  const newInventory = Math.max(0, totalQty - soldQty);

  const supabase = createServiceClient();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (startPrice > 0) updates.price = startPrice;
  if (totalQty > 0)   updates.inventory = newInventory;

  const { error } = await supabase
    .from("products")
    .update(updates as any)
    .eq("ebay_listing_id", itemId);

  if (!error) revalidateTag("products", "default");
  console.log(`[ebay/notifications] ItemRevised: ItemID ${itemId}`, updates);
}

async function handleItemClosed(itemId: string): Promise<void> {
  if (!itemId) return;

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("products")
    .update({ inventory: 0, is_published: false, updated_at: new Date().toISOString() } as any)
    .eq("ebay_listing_id", itemId);

  if (!error) revalidateTag("products", "default");
  console.log(`[ebay/notifications] ItemClosed: ItemID ${itemId} → inventory 0, unpublished`);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function resolveEndpointUrl(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return `${process.env.NEXT_PUBLIC_APP_URL}/api/ebay/notifications`;
  }
  const host = request.headers.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}/api/ebay/notifications`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepFind(obj: any, key: string): any {
  if (obj == null || typeof obj !== "object") return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const v of Object.values(obj)) {
    const found = deepFind(v, key);
    if (found !== undefined) return found;
  }
  return undefined;
}
