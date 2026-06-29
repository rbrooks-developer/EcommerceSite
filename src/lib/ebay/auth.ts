import { createServiceClient } from "@/lib/supabase/server";
import type { EbayConfig } from "@/types";

const EBAY_TOKEN_URL = "https://api.ebay.com/identity/v1/oauth2/token";
const EBAY_AUTH_URL = "https://auth.ebay.com/oauth2/authorize";
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

export async function getEbayConfig(): Promise<EbayConfig | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("site_settings")
    .select("ebay_config")
    .eq("id", 1)
    .single();
  if (!data) return null;
  return (data as any).ebay_config as EbayConfig ?? null;
}

export async function saveEbayConfig(updates: Partial<EbayConfig>): Promise<void> {
  const supabase = createServiceClient();
  const current = await getEbayConfig() ?? {};
  await supabase
    .from("site_settings")
    .update({ ebay_config: { ...current, ...updates } } as any)
    .eq("id", 1);
}

export function buildAuthorizeUrl(config: EbayConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.app_id,
    redirect_uri: config.ru_name,
    response_type: "code",
    scope: EBAY_SCOPES,
    state,
    prompt: "login",
  });
  return `${EBAY_AUTH_URL}?${params.toString()}`;
}

export async function getAppToken(config: EbayConfig): Promise<string> {
  const res = await fetch(EBAY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicAuth(config.app_id, config.cert_id),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
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
      Authorization: basicAuth(config.app_id, config.cert_id),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
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
