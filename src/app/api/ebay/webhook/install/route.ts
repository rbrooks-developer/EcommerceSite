import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getValidEbayConfig, saveEbayConfig, getAppToken } from "@/lib/ebay/auth";
import { setNotificationPreferences } from "@/lib/ebay/trading";

export const dynamic = "force-dynamic";

const COMMERCE_NOTIFICATION_BASE = "https://api.ebay.com/commerce/notification/v1";

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if (auth.error) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const config = await getValidEbayConfig();
  if (!config?.access_token) {
    return Response.json({ error: "eBay account not connected" }, { status: 400 });
  }

  const host = request.headers.get("host") ?? "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;
  const endpointUrl = `${appUrl}/api/ebay/notifications`;

  const results: Record<string, string> = {};

  // ── 1. Platform Notifications (System B) ─────────────────────────────────
  try {
    await setNotificationPreferences(config, endpointUrl);
    results.platform_notifications = "installed";
    await saveEbayConfig({
      platform_notifications_installed_at: new Date().toISOString(),
    });
  } catch (err) {
    results.platform_notifications = `error: ${(err as Error).message}`;
    console.error("[webhook/install] Platform notifications failed:", err);
  }

  // ── 2. Commerce Notification API — MARKETPLACE_ACCOUNT_DELETION (System A) ─
  try {
    const appToken = await getAppToken(config);

    // Generate or reuse verification token — must be saved to DB BEFORE calling
    // eBay's create-destination API, because eBay immediately fires a GET challenge
    // at our endpoint to verify it, and the handler reads the token from DB.
    const verificationToken = config.webhook_verification_token
      ?? randomBytes(32).toString("hex");

    if (!config.webhook_verification_token) {
      await saveEbayConfig({ webhook_verification_token: verificationToken });
    }

    // Create or update destination
    let destinationId = config.commerce_notification_destination_id ?? null;

    if (!destinationId) {
      const destRes = await fetch(`${COMMERCE_NOTIFICATION_BASE}/destination`, {
        method: "POST",
        headers: {
          Authorization:  `Bearer ${appToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name:           "GodlyComics Webhook",
          status:         "ENABLED",
          payloadVersion: "1.0",
          endpoint: {
            notificationContentType: "APPLICATION_JSON",
            endpointUrl,
            verificationToken,
          },
        }),
      });

      if (!destRes.ok) {
        const text = await destRes.text();
        throw new Error(`Create destination failed ${destRes.status}: ${text}`);
      }

      const destData = await destRes.json();
      destinationId = destData.destinationId as string;
    }

    // Create subscription for MARKETPLACE_ACCOUNT_DELETION
    const subRes = await fetch(`${COMMERCE_NOTIFICATION_BASE}/subscription`, {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${appToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicId:        "MARKETPLACE_ACCOUNT_DELETION",
        destinationId,
        payloadVersion: "1.0",
        status:         "ENABLED",
      }),
    });

    // 409 = subscription already exists — treat as success
    if (!subRes.ok && subRes.status !== 409) {
      const text = await subRes.text();
      throw new Error(`Create subscription failed ${subRes.status}: ${text}`);
    }

    // Persist destination ID + subscription timestamp
    await saveEbayConfig({
      commerce_notification_destination_id: destinationId,
      commerce_notification_subscribed_at:  new Date().toISOString(),
    });

    results.account_deletion = "subscribed";
  } catch (err) {
    results.account_deletion = `error: ${(err as Error).message}`;
    console.error("[webhook/install] Commerce notification failed:", err);
  }

  const hasError = Object.values(results).some((v) => v.startsWith("error:"));
  return Response.json({ results }, { status: hasError ? 207 : 200 });
}
