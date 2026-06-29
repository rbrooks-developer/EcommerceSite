import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getEbayConfig, refreshAccessToken } from "@/lib/ebay/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

  const config = await getEbayConfig();
  if (!config?.refresh_token) {
    return NextResponse.json({ error: "No refresh token — reconnect eBay first." }, { status: 400 });
  }

  try {
    const updated = await refreshAccessToken(config);
    return NextResponse.json({
      success: true,
      token_expires_at: updated.token_expires_at,
      access_token_prefix: updated.access_token?.slice(0, 20) + "…",
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
