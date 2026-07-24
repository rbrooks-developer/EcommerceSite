import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getValidEbayConfig, saveEbayConfig, getAppToken, deriveWebhookVerificationToken, resolveWebhookEndpointUrl } from "@/lib/ebay/auth";
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

  const host        = request.headers.get("host") ?? "";
  const endpointUrl = resolveWebhookEndpointUrl(host);
  const token       = deriveWebhookVerificationToken() ?? "";

  // Hash that eBay will verify against — include in debug so you can spot mismatches
  const { createHash } = await import("crypto");
  const exampleHash = createHash("sha256")
    .update("EXAMPLE_CHALLENGE" + token + endpointUrl)
    .digest("hex");

  const results: Record<string, string> = {};
  const debug: Record<string, string> = { endpointUrl, tokenPrefix: token.slice(0, 8) + "...", exampleHash };

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
    if (!token) throw new Error("eBay credentials not configured");
    const verificationToken = token;

    // Self-test: verify our challenge endpoint works before calling eBay.
    // Also detect URL redirects — eBay may not follow redirects, causing 195017.
    const selfTestCode = "self_test_" + Date.now();
    try {
      const stRes = await fetch(`${endpointUrl}?challenge_code=${encodeURIComponent(selfTestCode)}`);
      // response.url is the final URL after any redirects
      const finalUrl = stRes.url.split("?")[0];
      const expectedBase = endpointUrl.split("?")[0];
      if (finalUrl && finalUrl !== expectedBase) {
        // A redirect was followed — eBay may not follow it, causing 195017
        debug.challengeSelfTest = `REDIRECTED to ${finalUrl}`;
      } else if (stRes.ok) {
        const stBody  = await stRes.json() as { challengeResponse?: string };
        const returned = stBody.challengeResponse ?? "";
        const expected = createHash("sha256")
          .update(selfTestCode + verificationToken + endpointUrl)
          .digest("hex");
        debug.challengeSelfTest = returned === expected
          ? "PASS"
          : `FAIL returned=${returned.slice(0, 12)}… expected=${expected.slice(0, 12)}…`;
      } else {
        debug.challengeSelfTest = `HTTP ${stRes.status}`;
      }
    } catch (e) {
      debug.challengeSelfTest = `error: ${(e as Error).message}`;
    }

    const userToken = config.access_token ?? null;
    // Basic app token (basic scope) — used so far, failing
    const appToken  = await getAppToken(config);

    // Try a token with the Commerce Notification subscription scope specifically.
    // The basic scope token can LIST destinations but may not be allowed to CREATE them.
    let notifToken: string | null = null;
    try {
      notifToken = await getAppToken(
        config,
        "https://api.ebay.com/oauth/api_scope/commerce.notification.subscription",
      );
      debug.notifScopeToken = "obtained";
    } catch (e) {
      debug.notifScopeToken = `failed: ${(e as Error).message.slice(0, 120)}`;
    }

    // Show the full topic response — the "scope" field tells us what's needed
    const topicRes = await fetch(`${COMMERCE_NOTIFICATION_BASE}/topic/MARKETPLACE_ACCOUNT_DELETION`, {
      headers: { Authorization: `Bearer ${appToken}` },
    });
    debug.topicFull = `${topicRes.status}: ${(await topicRes.text()).slice(0, 500)}`;

    // List existing destinations
    let destinationId: string | null = null;
    const listToken = notifToken ?? appToken;
    const listRes = await fetch(`${COMMERCE_NOTIFICATION_BASE}/destination`, {
      headers: { Authorization: `Bearer ${listToken}` },
    });
    if (listRes.ok) {
      const listData  = await listRes.json() as { destinations?: { destinationId: string; deliveryConfig?: { endpointUrl?: string }; endpoint?: { endpointUrl?: string } }[] };
      const existing  = listData.destinations ?? [];
      const match = existing.find(
        (d) => d.deliveryConfig?.endpointUrl === endpointUrl || d.endpoint?.endpointUrl === endpointUrl,
      );
      if (match) {
        destinationId = match.destinationId;
        debug.destinationReused = destinationId;
      }
      debug.existingDestinations = String(existing.length);
    } else {
      debug.listError = `${listRes.status} ${(await listRes.text()).slice(0, 120)}`;
    }

    if (!destinationId) {
      // Try creating with the notification-scoped token first, then fall back to others.
      // statusOnlyProbe (no endpoint fields at all) gave 195017 with basic app token —
      // confirming this is a token scope issue, not an endpoint URL format issue.
      const destBody = {
        name:           "GodlyComics Webhook",
        status:         "ENABLED",
        payloadVersion: "1.0",
        endpoint:       { endpointUrl, verificationToken },
      };

      const tryWith = async (tok: string, label: string) => {
        const r = await fetch(`${COMMERCE_NOTIFICATION_BASE}/destination`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
          body:    JSON.stringify(destBody),
        });
        const t = await r.text();
        debug[`create_${label}`] = `${r.status}: ${t.slice(0, 200)}`;
        return r.ok ? (JSON.parse(t) as { destinationId?: string }) : null;
      };

      let destData: { destinationId?: string } | null = null;
      if (notifToken) destData = await tryWith(notifToken, "notifScope");
      if (!destData && userToken) { destData = await tryWith(userToken, "userToken"); }
      if (!destData)              { destData = await tryWith(appToken, "appToken"); }

      if (!destData) {
        throw new Error("Destination creation failed with all tokens — see debug.create_* fields");
      }

      destinationId = destData.destinationId ?? null;
      if (!destinationId) throw new Error("eBay returned no destinationId");
    }

    // Create subscription for MARKETPLACE_ACCOUNT_DELETION
    const subToken = notifToken ?? userToken ?? appToken;
    const subRes = await fetch(`${COMMERCE_NOTIFICATION_BASE}/subscription`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${subToken}`, "Content-Type": "application/json" },
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
  return Response.json({ results, debug }, { status: hasError ? 207 : 200 });
}
