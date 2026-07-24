import { createServiceClient } from "@/lib/supabase/server";
import type { EbayConfig } from "@/types";

const EBAY_TOKEN_URL    = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_AUTH_URL     = "https://auth.ebay.com/oauth2/authorize";
const EBAY_IDENTITY_URL = "https://apiz.ebay.com/commerce/identity/v1/user/";

export const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.account.readonly",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment.readonly",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
].join(" ");

function basicAuth(appId: string, certId: string): string {
  return `Basic ${Buffer.from(`${appId}:${certId}`).toString("base64")}`;
}

/** Credentials come from env vars; dynamic token data lives in the DB. */
export async function getEbayConfig(): Promise<EbayConfig | null> {
  const app_id  = process.env.EBAY_APP_ID?.trim();
  const dev_id  = process.env.EBAY_DEV_ID?.trim() ?? "";
  const cert_id = process.env.EBAY_CERT_ID?.trim();
  const ru_name = process.env.EBAY_RU_NAME?.trim();

  if (!app_id || !cert_id || !ru_name) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("site_settings")
    .select("ebay_config")
    .eq("id", 1)
    .single();

  const db = (data as any)?.ebay_config ?? {};

  return {
    app_id,
    dev_id,
    cert_id,
    ru_name,
    access_token:            db.access_token            ?? null,
    refresh_token:           db.refresh_token           ?? null,
    token_expires_at:        db.token_expires_at        ?? null,
    ebay_user_id:            db.ebay_user_id            ?? null,
    ebay_username:           db.ebay_username           ?? null,
    categories_synced_at:             db.categories_synced_at             ?? null,
    categories_count:                 db.categories_count                 ?? null,
    oauth_state:                      db.oauth_state                      ?? null,
    oauth_state_expires_at:           db.oauth_state_expires_at           ?? null,
    inventory_sync_enabled:           db.inventory_sync_enabled           ?? false,
    inventory_sync_interval_minutes:  db.inventory_sync_interval_minutes  ?? 60,
    inventory_sync_last_run:          db.inventory_sync_last_run          ?? null,
    listing_sync_enabled:             db.listing_sync_enabled             ?? false,
    listing_sync_last_run:            db.listing_sync_last_run            ?? null,
    price_discount_percent:           db.price_discount_percent           ?? 0,
    cgc_census_url:                       db.cgc_census_url                       ?? null,
    cgc_button_image_url:                 db.cgc_button_image_url                 ?? null,
    webhook_verification_token:           db.webhook_verification_token           ?? null,
    platform_notifications_installed_at:  db.platform_notifications_installed_at  ?? null,
    commerce_notification_destination_id: db.commerce_notification_destination_id ?? null,
    commerce_notification_subscribed_at:  db.commerce_notification_subscribed_at  ?? null,
    webhook_last_hits:                    db.webhook_last_hits                    ?? null,
  };
}

/** Updates the webhook_last_hits map for the given event type without clobbering other fields. */
export async function recordWebhookHit(eventType: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("site_settings")
    .select("ebay_config")
    .eq("id", 1)
    .single();

  const current   = (data as any)?.ebay_config ?? {};
  const priorHits = current.webhook_last_hits ?? {};

  await supabase
    .from("site_settings")
    .update({
      ebay_config: {
        ...current,
        webhook_last_hits: { ...priorHits, [eventType]: new Date().toISOString() },
      },
    } as any)
    .eq("id", 1);
}

/** Only persists token/state fields — credentials stay in env vars. */
export async function saveEbayConfig(updates: Partial<EbayConfig>): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { app_id, dev_id, cert_id, ru_name, ...dbUpdates } = updates;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("site_settings")
    .select("ebay_config")
    .eq("id", 1)
    .single();

  const current = (data as any)?.ebay_config ?? {};
  await supabase
    .from("site_settings")
    .update({ ebay_config: { ...current, ...dbUpdates } } as any)
    .eq("id", 1);
}

export function buildAuthorizeUrl(config: EbayConfig, state: string): string {
  const params = new URLSearchParams({
    client_id:     config.app_id,
    redirect_uri:  config.ru_name,
    response_type: "code",
    scope:         EBAY_SCOPES,
    state,
    prompt:        "login",
  });
  return `${EBAY_AUTH_URL}?${params.toString()}`;
}

export async function getAppToken(config: EbayConfig): Promise<string> {
  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization:  basicAuth(config.app_id, config.cert_id),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope:      "https://api.ebay.com/oauth/api_scope",
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay app token error ${res.status}: ${text}`);
  }
  const data = await res.json();
  return data.access_token as string;
}

export async function exchangeCodeForTokens(
  config: EbayConfig,
  code: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization:  basicAuth(config.app_id, config.cert_id),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:   "authorization_code",
      code,
      redirect_uri: config.ru_name,
    }).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay token exchange error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Uses the stored refresh token to get a new access token and persists it.
 * eBay access tokens last 2 hours; refresh tokens last 18 months.
 */
export async function refreshAccessToken(config: EbayConfig): Promise<EbayConfig> {
  if (!config.refresh_token) throw new Error("No refresh token stored — reconnect eBay.");

  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization:  basicAuth(config.app_id, config.cert_id),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type:    "refresh_token",
      refresh_token: config.refresh_token,
      scope:         EBAY_SCOPES,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`eBay token refresh failed ${res.status}: ${text}`);
  }

  const data = await res.json();
  const token_expires_at = new Date(Date.now() + data.expires_in * 1000).toISOString();

  const updates: Partial<EbayConfig> = {
    access_token: data.access_token,
    token_expires_at,
    // eBay may return a new refresh token; keep the existing one if not
    ...(data.refresh_token ? { refresh_token: data.refresh_token } : {}),
  };

  await saveEbayConfig(updates);
  return { ...config, ...updates };
}

/**
 * Returns a guaranteed-fresh eBay config. If the access token has expired
 * or will expire within 5 minutes it is silently refreshed first.
 */
export async function getValidEbayConfig(): Promise<EbayConfig | null> {
  const config = await getEbayConfig();
  if (!config?.access_token) return config;

  const expiresAt    = config.token_expires_at ? new Date(config.token_expires_at).getTime() : 0;
  const needsRefresh = Date.now() + 5 * 60 * 1000 >= expiresAt;

  if (!needsRefresh) return config;

  try {
    return await refreshAccessToken(config);
  } catch {
    return config; // Let the caller surface any downstream API errors
  }
}

export async function getEbayIdentity(
  accessToken: string
): Promise<{ userId: string; username: string }> {
  try {
    const res = await fetch(EBAY_IDENTITY_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return { userId: "", username: "" };
    const data = await res.json();
    return { userId: data.userId ?? "", username: data.username ?? "" };
  } catch {
    return { userId: "", username: "" };
  }
}
