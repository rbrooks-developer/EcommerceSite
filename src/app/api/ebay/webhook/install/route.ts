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

    // Try user access token first (has broader scope); fall back to app token
    const userToken  = config.access_token ?? null;
    const appToken   = await getAppToken(config);
    const bearerToken = userToken ?? appToken;

    // List existing destinations to avoid conflicts and detect stale state
    let destinationId: string | null = null;
    const listRes = await fetch(`${COMMERCE_NOTIFICATION_BASE}/destination`, {
      headers: { Authorization: `Bearer ${bearerToken}` },
    });
    if (listRes.ok) {
      const listData  = await listRes.json() as { destinations?: { destinationId: string; deliveryConfig?: { endpointUrl?: string }; endpoint?: { endpointUrl?: string } }[] };
      const existing  = listData.destinations ?? [];
      // Reuse destination if one already points to our URL (check both field names)
      const match = existing.find(
        (d) => d.deliveryConfig?.endpointUrl === endpointUrl || d.endpoint?.endpointUrl === endpointUrl,
      );
      if (match) {
        destinationId = match.destinationId;
        debug.destinationReused = destinationId;
      }
      debug.existingDestinations = String(existing.length);
    } else {
      debug.listError = `${listRes.status} ${await listRes.text()}`;
    }

    if (!destinationId) {
      // Probe multiple payload shapes — eBay is rejecting BOTH ENABLED and DISABLED,
      // meaning the request body itself is wrong (not the live challenge). Try four
      // combinations of (field name) × (payloadVersion presence) with DISABLED status
      // so we avoid the challenge complication. First success wins.
      type Shape = { label: string; body: Record<string, unknown> };
      const shapes: Shape[] = [
        {
          label: "deliveryConfig+pv",
          body: { name: "GodlyComics Webhook", status: "DISABLED", payloadVersion: "1.0", deliveryConfig: { endpointUrl, verificationToken } },
        },
        {
          label: "endpoint+pv",
          body: { name: "GodlyComics Webhook", status: "DISABLED", payloadVersion: "1.0", endpoint: { endpointUrl, verificationToken } },
        },
        {
          label: "deliveryConfig_nopv",
          body: { name: "GodlyComics Webhook", status: "DISABLED", deliveryConfig: { endpointUrl, verificationToken } },
        },
        {
          label: "endpoint_nopv",
          body: { name: "GodlyComics Webhook", status: "DISABLED", endpoint: { endpointUrl, verificationToken } },
        },
      ];

      let winningShape: Shape | null = null;
      for (const shape of shapes) {
        const r = await fetch(`${COMMERCE_NOTIFICATION_BASE}/destination`, {
          method:  "POST",
          headers: { Authorization: `Bearer ${appToken}`, "Content-Type": "application/json" },
          body:    JSON.stringify(shape.body),
        });
        const t = await r.text();
        debug[`probe_${shape.label}`] = `${r.status}: ${t.slice(0, 160)}`;
        if (r.ok) {
          const d = JSON.parse(t) as { destinationId?: string };
          winningShape = shape;
          // Clean up the DISABLED destination immediately
          if (d.destinationId) {
            await fetch(`${COMMERCE_NOTIFICATION_BASE}/destination/${d.destinationId}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${appToken}` },
            });
            debug.winningShape = shape.label;
          }
          break;
        }
      }

      if (!winningShape) {
        throw new Error("All payload shape probes failed — see debug.probe_* fields");
      }

      // Re-create with ENABLED using the winning shape and the user token if available
      const enabledBody = { ...winningShape.body, status: "ENABLED" };
      debug.userTokenTried = String(!!userToken);
      let destRes = userToken
        ? await fetch(`${COMMERCE_NOTIFICATION_BASE}/destination`, {
            method: "POST",
            headers: { Authorization: `Bearer ${userToken}`, "Content-Type": "application/json" },
            body:   JSON.stringify(enabledBody),
          })
        : null;

      if (!destRes?.ok) {
        destRes = await fetch(`${COMMERCE_NOTIFICATION_BASE}/destination`, {
          method: "POST",
          headers: { Authorization: `Bearer ${appToken}`, "Content-Type": "application/json" },
          body:   JSON.stringify(enabledBody),
        });
        debug.appTokenFallback = "true";
      }

      if (!destRes.ok) {
        const text = await destRes.text();
        throw new Error(`Create ENABLED destination failed ${destRes.status}: ${text}`);
      }

      const destData = await destRes.json() as { destinationId?: string };
      destinationId  = destData.destinationId ?? null;
      if (!destinationId) throw new Error("eBay returned no destinationId");
    }

    // Create subscription for MARKETPLACE_ACCOUNT_DELETION
    const subRes = await fetch(`${COMMERCE_NOTIFICATION_BASE}/subscription`, {
      method:  "POST",
      headers: { Authorization: `Bearer ${bearerToken}`, "Content-Type": "application/json" },
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
