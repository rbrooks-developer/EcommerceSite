import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEbayConfig, saveEbayConfig, buildAuthorizeUrl } from "@/lib/ebay/auth";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const base = new URL("/admin/ebay", request.url);

  try {
    const auth = await requireAdmin();
    if (auth.error) {
      base.searchParams.set("error", "unauthorized");
      return NextResponse.redirect(base);
    }

    const config = await getEbayConfig();
    if (!config?.app_id || !config?.cert_id || !config?.ru_name) {
      base.searchParams.set("error", "missing_credentials");
      return NextResponse.redirect(base);
    }

    // Store state in DB (10-minute window) — avoids cookie/redirect race conditions
    const state = randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    await saveEbayConfig({ oauth_state: state, oauth_state_expires_at: expiresAt });

    return NextResponse.redirect(buildAuthorizeUrl(config, state));
  } catch (err) {
    console.error("[ebay/auth]", err);
    base.searchParams.set("error", "server_error");
    return NextResponse.redirect(base);
  }
}
