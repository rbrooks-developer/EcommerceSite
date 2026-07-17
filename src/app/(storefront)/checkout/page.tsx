import type { Metadata } from "next";
import { getSettings } from "@/lib/data/settings";
import { COUNTRIES } from "@/lib/data/countries";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { CheckoutFlow } from "./CheckoutFlow";
import type { UserAddress, CheckoutConfig, SurchargeConfig } from "@/types";
import type { AppliedPromo } from "@/lib/actions/promos";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [settings, supabase] = await Promise.all([getSettings(), createClient()]);
  const allowedCodes = ((settings as any)?.shipping_countries as string[] | null) ?? ["US"];
  const allowedCountries = COUNTRIES.filter((c) => allowedCodes.includes(c.code));

  const { data: { user } } = await supabase.auth.getUser();
  let defaultShipping: UserAddress | null = null;
  let initialPromo: AppliedPromo | null = null;

  if (user) {
    const sb = createServiceClient();
    const [addrResult, promoResult] = await Promise.all([
      supabase.from("user_addresses").select("*").eq("user_id", user.id).eq("label", "shipping").eq("is_default_shipping", true).maybeSingle(),
      sb.from("cart_promos").select("promo_code").eq("user_id", user.id).maybeSingle(),
    ]);
    defaultShipping = (addrResult.data as UserAddress | null) ?? null;

    if (promoResult.data) {
      const { data: promoData } = await sb
        .from("promos")
        .select("code, discount_type, discount_value, max_shipping_discount, allow_international")
        .eq("code", (promoResult.data as { promo_code: string }).promo_code)
        .eq("enabled", true)
        .maybeSingle();
      if (promoData) initialPromo = promoData as AppliedPromo;
    }
  }

  const checkoutConfig = (settings as any)?.checkout_config as CheckoutConfig | null;
  const surchargeConfig = (settings as any)?.surcharge_config as SurchargeConfig | null;

  return <CheckoutFlow allowedCountries={allowedCountries} defaultShipping={defaultShipping} initialPromo={initialPromo} checkoutConfig={checkoutConfig} surchargeConfig={surchargeConfig} />;
}
