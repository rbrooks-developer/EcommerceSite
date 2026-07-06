import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { PromoBanner } from "@/components/storefront/PromoBanner";
import { CartProvider } from "@/lib/cart/store";
import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import type { NavConfig, FooterConfig, ContactInfo, HomepageConfig } from "@/types";
import { checkSitePassword } from "@/lib/sitePasswordGate";
import type { PromoBanner as PromoBannerType } from "@/lib/actions/promos";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [settings, supabase] = await Promise.all([getSettings(), createClient()]);
  await checkSitePassword(settings);
  const { data: { user } } = await supabase.auth.getUser();

  const [profileResult, approvedOffersResult] = await Promise.all([
    user ? supabase.from("profiles").select("role, avatar_url").eq("id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("product_offers").select("*", { count: "exact", head: true }).eq("user_id", user.id).in("status", ["approved", "countered"]) : Promise.resolve({ count: 0 }),
  ]);

  const isAdmin = ((profileResult.data as { role: string } | null)?.role === "admin");
  const avatarUrl = (profileResult.data as { avatar_url?: string | null } | null)?.avatar_url ?? null;
  const approvedOffersCount = approvedOffersResult.count ?? 0;

  const homepage = settings?.homepage_config as HomepageConfig | null;
  const bgColor = homepage?.bg_color ?? "#ffffff";
  const fontColor = homepage?.font_color ?? "#111827";
  const fontGradient = homepage?.font_gradient_enabled ?? false;
  const striationImageUrl = homepage?.striation_image_url ?? null;
  const striationOpacity = homepage?.striation_opacity ?? 30;
  const striationBlendMode = (homepage?.striation_blend_mode ?? "screen") as React.CSSProperties["mixBlendMode"];
  const striationPosition = homepage?.striation_position ?? "full";

  return (
    <CartProvider userId={user?.id}>
      {striationImageUrl && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 45,
            pointerEvents: "none",
            backgroundImage: `url(${striationImageUrl})`,
            backgroundSize: striationPosition === "full" ? "cover" : striationPosition === "tile" ? "auto" : "auto 100%",
            backgroundPosition: striationPosition === "left" ? "left center" : striationPosition === "right" ? "right center" : "center",
            backgroundRepeat: striationPosition === "tile" ? "repeat" : "no-repeat",
            opacity: striationOpacity / 100,
            mixBlendMode: striationBlendMode,
          }}
        />
      )}
      <div {...(fontGradient ? { "data-text-gradient": "true" } : {})} className="min-h-screen flex flex-col">
      <Header
        siteTitle={settings?.site_title ?? "My Store"}
        logoUrl={settings?.logo_url ?? null}
        logoSpin={!!(settings as any)?.logo_spin_header}
        navConfig={(settings?.nav_config as NavConfig) ?? { items: [] }}
        isLoggedIn={!!user}
        isAdmin={isAdmin}
        avatarUrl={avatarUrl}
        bgColor={bgColor}
        fontColor={fontColor}
        approvedOffersCount={approvedOffersCount}
        striationImageUrl={striationImageUrl}
        striationOpacity={striationOpacity}
        striationBlendMode={striationBlendMode}
        striationPosition={striationPosition}
      />
      <PromoBanner banner={(settings as any)?.promo_banner as PromoBannerType | null} />
      <main className="flex-1">{children}</main>
      <Footer
        siteTitle={settings?.site_title ?? "My Store"}
        logoUrl={settings?.logo_url ?? null}
        logoSpin={!!(settings as any)?.logo_spin_footer}
        footerConfig={(settings?.footer_config as FooterConfig) ?? { links: [], social: [], copyright_text: "" }}
        contactInfo={(settings?.contact_info as ContactInfo) ?? { email: null, phone: null, address: null }}
        bgColor={bgColor}
        fontColor={fontColor}
      />
      </div>
    </CartProvider>
  );
}
