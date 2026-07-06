"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { validatePromoCode } from "@/lib/promos/validate";
import { revalidatePath } from "next/cache";
import type { PromoDiscountType } from "@/types/database";

export type AppliedPromo = {
  code: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  max_shipping_discount: number | null;
};

export type PromoBanner = {
  enabled: boolean;
  html: string;
  bg_color: string;
  text_color: string;
  font_size: string;
};

export type PromoFormData = {
  code: string;
  description: string;
  enabled: boolean;
  discount_type: PromoDiscountType;
  discount_value: number;
  max_shipping_discount: number | null;
  start_date: string | null;
  expiration_date: string | null;
  minimum_order: number | null;
  maximum_order: number | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
};

// ─── Admin: promo CRUD ────────────────────────────────────────────────────────

export async function createPromo(data: PromoFormData): Promise<{ error?: string }> {
  const sb = createServiceClient();
  const { error } = await sb.from("promos").insert({
    ...data,
    code: data.code.trim().toUpperCase(),
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/promos");
  return {};
}

export async function updatePromo(id: string, data: PromoFormData): Promise<{ error?: string }> {
  const sb = createServiceClient();
  const { error } = await sb.from("promos").update({
    ...data,
    code: data.code.trim().toUpperCase(),
    updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/promos");
  revalidatePath(`/admin/promos/${id}/edit`);
  return {};
}

export async function deletePromo(id: string): Promise<{ error?: string }> {
  const sb = createServiceClient();
  const { error } = await sb.from("promos").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/promos");
  return {};
}

export async function togglePromoEnabled(id: string, enabled: boolean): Promise<{ error?: string }> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("promos")
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/promos");
  return {};
}

// ─── Admin: banner ────────────────────────────────────────────────────────────

export async function updatePromoBanner(data: PromoBanner): Promise<{ error?: string }> {
  const sb = createServiceClient();
  const { error } = await sb
    .from("site_settings")
    .update({ promo_banner: data as any, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { error: error.message };
  revalidatePath("/admin/promos");
  revalidatePath("/");
  revalidatePath("/products");
  return {};
}

// ─── Customer: apply/remove promo ────────────────────────────────────────────

export async function applyPromoCode(code: string): Promise<{
  ok: boolean;
  error?: string;
  promo?: AppliedPromo;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You must be signed in to apply a promo code." };

  const sb = createServiceClient();
  const { data: cartItems } = await sb
    .from("cart_items")
    .select("price, quantity")
    .eq("user_id", user.id);
  const subtotal = ((cartItems ?? []) as { price: number; quantity: number }[]).reduce(
    (sum, i) => sum + Number(i.price) * i.quantity,
    0
  );

  const result = await validatePromoCode(sb, code, user.id, subtotal);
  if (!result.valid) return { ok: false, error: result.error };

  await sb.from("cart_promos").upsert(
    { user_id: user.id, promo_code: result.promo.code, applied_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );

  return {
    ok: true,
    promo: {
      code: result.promo.code,
      discount_type: result.promo.discount_type,
      discount_value: result.promo.discount_value,
      max_shipping_discount: result.promo.max_shipping_discount,
    },
  };
}

export async function removePromoCode(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const sb = createServiceClient();
  await sb.from("cart_promos").delete().eq("user_id", user.id);
}
