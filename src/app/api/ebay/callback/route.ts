import { NextRequest, NextResponse } from "next/server";
import {
  getEbayConfig,
  saveEbayConfig,
  exchangeCodeForTokens,
  getEbayIdentity,
} from "@/lib/ebay/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code      = searchParams.get("code");
  const state     = searchParams.get("state");
  const ebayError = searchParams.get("error");

  const redirect = (params: string) =>
    NextResponse.redirect(new URL(`/admin/ebay?${params}`, request.url));

  if (ebayError) return redirect("error=access_denied");

  try {
    const config = await getEbayConfig();
    if (!config?.app_id || !config?.cert_id || !config?.ru_name) {
      return redirect("error=missing_credentials");
    }

    const storedState  = config.oauth_state;
    const stateExpiry  = config.oauth_state_expires_at;
    const stateExpired = stateExpiry ? new Date(stateExpiry) < new Date() : true;

    if (!code || !state || state !== storedState || stateExpired) {
      return redirect("error=invalid_state");
    }

    // Clear the one-time state immediately
    await saveEbayConfig({ oauth_state: null, oauth_state_expires_at: null });

    const tokens   = await exchangeCodeForTokens(config, code);
    const identity = await getEbayIdentity(tokens.access_token);

    await saveEbayConfig({
      access_token:     tokens.access_token,
      refresh_token:    tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      ebay_user_id:     identity.userId   || null,
      ebay_username:    identity.username || null,
    });

    return redirect("success=connected");
  } catch (err) {
    console.error("[ebay/callback]", err);
    return redirect("error=token_exchange_failed");
  }
}
