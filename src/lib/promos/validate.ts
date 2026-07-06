import type { SupabaseClient } from "@supabase/supabase-js";

export type PromoRow = {
  id: string;
  code: string;
  description: string | null;
  enabled: boolean;
  discount_type: "percentage" | "fixed" | "free_shipping";
  discount_value: number;
  max_shipping_discount: number | null;
  start_date: string | null;
  expiration_date: string | null;
  minimum_order: number | null;
  maximum_order: number | null;
  max_uses: number | null;
  current_uses: number;
  max_uses_per_customer: number | null;
  created_at: string;
  updated_at: string;
};

export type ValidateResult =
  | { valid: true; promo: PromoRow }
  | { valid: false; error: string };

export async function validatePromoCode(
  supabase: SupabaseClient,
  code: string,
  userId: string | null,
  subtotal: number
): Promise<ValidateResult> {
  const { data } = await supabase
    .from("promos")
    .select("*")
    .eq("code", code.trim().toUpperCase())
    .maybeSingle();

  if (!data) return { valid: false, error: "Promo code not found." };
  const promo = data as PromoRow;

  if (!promo.enabled) return { valid: false, error: "This promo code is no longer active." };

  const now = new Date();
  if (promo.start_date && new Date(promo.start_date) > now)
    return { valid: false, error: "This promo code is not yet active." };
  if (promo.expiration_date && new Date(promo.expiration_date) < now)
    return { valid: false, error: "This promo code has expired." };

  if (promo.max_uses != null && promo.current_uses >= promo.max_uses)
    return { valid: false, error: "This promo code has reached its usage limit." };

  if (promo.minimum_order != null && subtotal < promo.minimum_order)
    return { valid: false, error: `Minimum order of $${promo.minimum_order.toFixed(2)} required.` };
  if (promo.maximum_order != null && subtotal > promo.maximum_order)
    return { valid: false, error: `This promo is only valid for orders under $${promo.maximum_order.toFixed(2)}.` };

  if (promo.max_uses_per_customer != null && userId) {
    const { count } = await supabase
      .from("promo_redemptions")
      .select("*", { count: "exact", head: true })
      .eq("promo_id", promo.id)
      .eq("customer_id", userId);
    if ((count ?? 0) >= promo.max_uses_per_customer)
      return { valid: false, error: "You have already used this promo code the maximum number of times." };
  }

  return { valid: true, promo };
}
