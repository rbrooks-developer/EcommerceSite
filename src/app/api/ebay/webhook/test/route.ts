import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEbayConfig } from "@/lib/ebay/auth";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

type EventType =
  | "FixedPriceTransaction"
  | "ItemRevised"
  | "ItemClosed"
  | "MARKETPLACE_ACCOUNT_DELETION"
  | "challenge";

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if (auth.error) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { event } = (await request.json()) as { event: EventType };

  const host = request.headers.get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
  const notifUrl = `${appUrl}/api/ebay/notifications`;

  if (event === "challenge") {
    return testChallenge(notifUrl, appUrl);
  }

  if (event === "MARKETPLACE_ACCOUNT_DELETION") {
    return testCommerceNotification(notifUrl);
  }

  return testPlatformNotification(notifUrl, event as "FixedPriceTransaction" | "ItemRevised" | "ItemClosed");
}

// ── Challenge test ────────────────────────────────────────────────────────────

async function testChallenge(notifUrl: string, appUrl: string): Promise<Response> {
  const testCode = "test_challenge_" + Date.now();
  const res = await fetch(`${notifUrl}?challenge_code=${testCode}`, { method: "GET" });

  if (!res.ok) {
    return Response.json({ success: false, error: `HTTP ${res.status}` });
  }

  const body = await res.json();
  const returned: string = body?.challengeResponse ?? "";

  // Verify the hash ourselves
  const config = await getEbayConfig();
  const token = config?.webhook_verification_token;
  if (!token) {
    return Response.json({ success: false, error: "No verification token stored — install webhooks first" });
  }

  const expected = createHash("sha256")
    .update(testCode + token + `${appUrl}/api/ebay/notifications`)
    .digest("hex");

  const match = returned === expected;
  return Response.json({
    success: match,
    returned,
    expected,
    error: match ? null : "Challenge hash mismatch",
  });
}

// ── Commerce Notification test (MARKETPLACE_ACCOUNT_DELETION) ─────────────────

async function testCommerceNotification(notifUrl: string): Promise<Response> {
  const payload = {
    metadata: { topic: "MARKETPLACE_ACCOUNT_DELETION", schemaVersion: "1.0", deprecated: false },
    notification: {
      notificationId: "test-" + Date.now(),
      eventDate: new Date().toISOString(),
      publishDate: new Date().toISOString(),
      publishAttemptCount: 1,
      data: {
        username: "test_buyer_user",
        userId:   "TEST_EBAY_USER_ID",
        eiasToken: "TEST_EIAS_TOKEN",
      },
    },
  };

  const res = await fetch(notifUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(payload),
  });

  return Response.json({ success: res.ok, status: res.status });
}

// ── Platform Notification test (SOAP/XML) ────────────────────────────────────

async function testPlatformNotification(
  notifUrl: string,
  event: "FixedPriceTransaction" | "ItemRevised" | "ItemClosed",
): Promise<Response> {
  const xml = buildSoapPayload(event);

  const res = await fetch(notifUrl, {
    method:  "POST",
    headers: { "Content-Type": "text/xml; charset=utf-8" },
    body:    xml,
  });

  return Response.json({ success: res.ok, status: res.status });
}

function buildSoapPayload(event: string): string {
  const itemId = "TEST_ITEM_" + Date.now();

  const transactionBlock =
    event === "FixedPriceTransaction"
      ? `<Transactions><Transaction><QuantityPurchased>1</QuantityPurchased></Transaction></Transactions>`
      : "";

  const statusBlock =
    event === "ItemClosed"
      ? `<SellingStatus><ListingStatus>Ended</ListingStatus></SellingStatus>`
      : `<SellingStatus><ListingStatus>Active</ListingStatus></SellingStatus>`;

  const priceBlock =
    event === "ItemRevised"
      ? `<StartPrice>9.99</StartPrice><Quantity>5</Quantity>`
      : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <GetItemResponse xmlns="urn:ebay:apis:eBLBaseComponents">
      <Timestamp>${new Date().toISOString()}</Timestamp>
      <Ack>Success</Ack>
      <NotificationEventName>${event}</NotificationEventName>
      <Item>
        <ItemID>${itemId}</ItemID>
        <Title>Test Item — Webhook Verification</Title>
        ${priceBlock}
        ${statusBlock}
        ${transactionBlock}
      </Item>
    </GetItemResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}
