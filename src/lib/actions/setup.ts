"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { FEATURE_SQL } from "@/lib/setup-sql";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function tableExists(tableName: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await (sb as any).from(tableName).select("*", { head: true, count: "exact" });
  return !error;
}

async function columnExists(tableName: string, column: string): Promise<boolean> {
  const sb = createServiceClient();
  const { error } = await (sb as any).from(tableName).select(column).limit(0);
  return !error;
}

async function runManagementSQL(sql: string): Promise<{ error?: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  const ref = match?.[1];
  const token = process.env.SUPABASE_ACCESS_TOKEN;

  if (!token) return { error: "SUPABASE_ACCESS_TOKEN is not set in your environment variables." };
  if (!ref) return { error: "Could not extract project ref from NEXT_PUBLIC_SUPABASE_URL." };

  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { error: `Supabase API error ${res.status}: ${text}` };
  }
  return {};
}

// ─── Status check ──────────────────────────────────────────────────────────

export type CheckItem = { label: string; ok: boolean };

export type FeatureResult = {
  ok: boolean;
  items: CheckItem[];
  sql?: string;
};

export type SetupStatus = {
  hasManagementToken: boolean;
  core: FeatureResult;
  promos: FeatureResult;
  ebay: FeatureResult;
  aboutUs: FeatureResult;
  stripe: FeatureResult;
  easypost: FeatureResult;
  resend: FeatureResult;
  cron: FeatureResult;
};

export async function checkSetupStatus(): Promise<SetupStatus> {
  const [
    ordersOk, productsOk, siteSettingsOk,
    promosOk, cartPromosOk, promoRedemptionsOk,
    promoColOk, ebayColOk, aboutColOk,
  ] = await Promise.all([
    tableExists("orders"),
    tableExists("products"),
    tableExists("site_settings"),
    tableExists("promos"),
    tableExists("cart_promos"),
    tableExists("promo_redemptions"),
    columnExists("orders", "promo_code"),
    columnExists("site_settings", "ebay_config"),
    columnExists("site_settings", "about_config"),
  ]);

  const env = (key: string) => !!process.env[key];

  const promoItems: CheckItem[] = [
    { label: "promos table", ok: promosOk },
    { label: "cart_promos table", ok: cartPromosOk },
    { label: "promo_redemptions table", ok: promoRedemptionsOk },
    { label: "orders promo columns", ok: promoColOk },
    { label: "site_settings.promo_banner", ok: true }, // always present if site_settings exists
  ];

  const ebayEnvItems: CheckItem[] = [
    { label: "EBAY_APP_ID", ok: env("EBAY_APP_ID") },
    { label: "EBAY_CERT_ID", ok: env("EBAY_CERT_ID") },
    { label: "EBAY_RU_NAME", ok: env("EBAY_RU_NAME") },
    { label: "site_settings.ebay_config column", ok: ebayColOk },
  ];

  const stripeItems: CheckItem[] = [
    { label: "STRIPE_SECRET_KEY", ok: env("STRIPE_SECRET_KEY") },
    { label: "STRIPE_WEBHOOK_SECRET", ok: env("STRIPE_WEBHOOK_SECRET") },
  ];

  const easypostItems: CheckItem[] = [
    { label: "EASYPOST_API_KEY", ok: env("EASYPOST_API_KEY") },
  ];

  const resendItems: CheckItem[] = [
    { label: "RESEND_API_KEY", ok: env("RESEND_API_KEY") },
    { label: "RESEND_FROM_EMAIL", ok: env("RESEND_FROM_EMAIL") },
  ];

  const cronItems: CheckItem[] = [
    { label: "CRON_SECRET", ok: env("CRON_SECRET") },
    { label: "NEXT_PUBLIC_APP_URL", ok: env("NEXT_PUBLIC_APP_URL") },
  ];

  return {
    hasManagementToken: env("SUPABASE_ACCESS_TOKEN"),
    core: {
      ok: ordersOk && productsOk && siteSettingsOk,
      items: [
        { label: "orders table", ok: ordersOk },
        { label: "products table", ok: productsOk },
        { label: "site_settings table", ok: siteSettingsOk },
      ],
    },
    promos: {
      ok: promoItems.every((i) => i.ok),
      items: promoItems,
      sql: FEATURE_SQL.promos,
    },
    ebay: {
      ok: ebayEnvItems.every((i) => i.ok),
      items: ebayEnvItems,
      sql: ebayColOk ? undefined : FEATURE_SQL.ebay,
    },
    aboutUs: {
      ok: aboutColOk,
      items: [{ label: "site_settings.about_config column", ok: aboutColOk }],
      sql: aboutColOk ? undefined : FEATURE_SQL.aboutUs,
    },
    stripe: { ok: stripeItems.every((i) => i.ok), items: stripeItems },
    easypost: { ok: easypostItems.every((i) => i.ok), items: easypostItems },
    resend: { ok: resendItems.every((i) => i.ok), items: resendItems },
    cron: { ok: cronItems.every((i) => i.ok), items: cronItems },
  };
}

// ─── Install action ────────────────────────────────────────────────────────

export async function installFeature(
  featureId: keyof typeof FEATURE_SQL
): Promise<{ ok?: boolean; error?: string }> {
  const sql = FEATURE_SQL[featureId];
  if (!sql) return { error: "Unknown feature" };
  const result = await runManagementSQL(sql);
  if (result.error) return { error: result.error };
  revalidatePath("/admin/setup");
  return { ok: true };
}
