"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getResendClient, FROM_EMAIL } from "@/lib/resend/client";
import { getSettings } from "@/lib/data/settings";
import { revalidatePath } from "next/cache";
import { formatPrice } from "@/lib/utils";
import type { HomepageConfig } from "@/types";

export type EmailTemplateData = {
  name: string;
  subject: string;
  body: string;
};

export type EmailTemplate = EmailTemplateData & {
  id: string;
  created_at: string;
  updated_at: string;
};

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const sb = createServiceClient();
  const { data } = await sb.from("email_templates").select("*").order("created_at", { ascending: false });
  return (data ?? []) as EmailTemplate[];
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate | null> {
  const sb = createServiceClient();
  const { data } = await sb.from("email_templates").select("*").eq("id", id).maybeSingle();
  return data as EmailTemplate | null;
}

export async function createEmailTemplate(data: EmailTemplateData): Promise<{ id?: string; error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const sb = createServiceClient();
  const { data: row, error } = await sb.from("email_templates").insert({
    ...data,
    updated_at: new Date().toISOString(),
  }).select("id").single();

  if (error) return { error: error.message };
  revalidatePath("/admin/email-templates");
  return { id: (row as { id: string }).id };
}

export async function updateEmailTemplate(id: string, data: EmailTemplateData): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const sb = createServiceClient();
  const { error } = await sb.from("email_templates").update({
    ...data,
    updated_at: new Date().toISOString(),
  }).eq("id", id);

  if (error) return { error: error.message };
  revalidatePath("/admin/email-templates");
  revalidatePath(`/admin/email-templates/${id}/edit`);
  return {};
}

export async function deleteEmailTemplate(id: string): Promise<{ error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const sb = createServiceClient();
  const { error } = await sb.from("email_templates").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/email-templates");
  return {};
}

// ── Send Promo to Fans ────────────────────────────────────────────────────────

function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? `{{${key}}}`);
}

export async function sendPromoToFans(
  productId: string,
  templateId: string,
  promoId: string,
): Promise<{ sent: number; error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return { sent: 0, error: auth.error };

  const sb = createServiceClient();

  // Fetch all required data in parallel
  const [productRes, templateRes, promoRes, adminRes, settings] = await Promise.all([
    sb.from("products").select("id, name, description, price, images").eq("id", productId).maybeSingle(),
    sb.from("email_templates").select("*").eq("id", templateId).maybeSingle(),
    sb.from("promos").select("code, discount_type, discount_value, expiration_date").eq("id", promoId).maybeSingle(),
    sb.from("profiles").select("id").eq("role", "admin"),
    getSettings(),
  ]);

  const product = productRes.data as { id: string; name: string; description: string | null; price: number; images: string[] } | null;
  const template = templateRes.data as EmailTemplate | null;
  const promo = promoRes.data as { code: string; discount_type: string; discount_value: number; expiration_date: string | null } | null;

  if (!product) return { sent: 0, error: "Product not found" };
  if (!template) return { sent: 0, error: "Template not found" };
  if (!promo) return { sent: 0, error: "Promo not found" };

  const adminIds = new Set((adminRes.data ?? []).map((p: { id: string }) => p.id));

  // Get all non-admin fans of this product
  const { data: favRows } = await sb
    .from("product_favorites")
    .select("user_id")
    .eq("product_id", productId);

  const fanIds = [...new Set(
    (favRows ?? []).map((r: { user_id: string }) => r.user_id).filter((id) => !adminIds.has(id))
  )];

  if (fanIds.length === 0) return { sent: 0, error: "No fans to email for this product" };

  // Resolve emails from auth
  const { data: { users } } = await sb.auth.admin.listUsers({ perPage: 1000 });
  const emailMap = new Map(users.map((u) => [u.id, u.email ?? ""]));

  const homepage = settings?.homepage_config as HomepageConfig | null;
  const storeName = settings?.site_title ?? "My Store";
  const storeUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const fromDisplay = homepage?.font_color ? storeName : storeName;
  const fromField = `${storeName} <${FROM_EMAIL}>`;

  const discountLabel =
    promo.discount_type === "percent"
      ? `${promo.discount_value}% off`
      : formatPrice(promo.discount_value * 100) + " off";

  const expiryLabel = promo.expiration_date
    ? new Date(promo.expiration_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "Limited time";

  const imageUrl = (product.images as string[])?.[0] ?? "";

  const vars: Record<string, string> = {
    "product.name": product.name,
    "product.description": product.description ?? "",
    "product.price": formatPrice(Number(product.price) * 100),
    "product.image_url": imageUrl,
    "promo.code": promo.code,
    "promo.discount": discountLabel,
    "promo.expiry": expiryLabel,
    "store.name": storeName,
    "store.url": storeUrl,
  };

  const resend = getResendClient();
  let sent = 0;

  // Send in batches of 50 (Resend batch limit)
  const emails = fanIds.map((id) => emailMap.get(id)).filter(Boolean) as string[];
  for (let i = 0; i < emails.length; i += 50) {
    const batch = emails.slice(i, i + 50).map((to) => ({
      from: fromField,
      to,
      subject: substituteVars(template.subject, vars),
      html: substituteVars(template.body, vars),
    }));
    await resend.batch.send(batch);
    sent += batch.length;
  }

  return { sent };
}
