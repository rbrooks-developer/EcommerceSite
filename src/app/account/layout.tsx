import type { Metadata } from "next";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { CartProvider } from "@/lib/cart/store";
import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import type { NavConfig, FooterConfig, ContactInfo, HomepageConfig } from "@/types";
import { checkSitePassword } from "@/lib/sitePasswordGate";

export const metadata: Metadata = {
  title: "My Account",
  robots: { index: false, follow: false },
};

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
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
            backgroundSize: striationPosition === "full" ? "cover" : striationPosition === "stretch" ? "100% 100%" : striationPosition === "contain" ? "contain" : striationPosition === "tile" ? "auto" : "auto 100%",
            backgroundPosition: striationPosition === "left" ? "left center" : striationPosition === "right" ? "right center" : "center",
            backgroundRepeat: striationPosition === "tile" ? "repeat" : "no-repeat",
            opacity: striationOpacity / 100,
            mixBlendMode: striationBlendMode,
          }}
        />
      )}
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
      <main className="flex-1">
        <div
          className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8"
          style={{
            "--input-bg": "var(--checkout-input-bg, color-mix(in srgb, var(--site-fg) 8%, var(--site-bg)))",
            "--input-text": "var(--site-fg, #111827)",
            "--input-border": "color-mix(in srgb, var(--site-fg) 30%, transparent)",
          } as React.CSSProperties}
        >
          {children}
        </div>
      </main>
      <Footer
        siteTitle={settings?.site_title ?? "My Store"}
        logoUrl={settings?.logo_url ?? null}
        logoSpin={!!(settings as any)?.logo_spin_footer}
        footerConfig={(settings?.footer_config as FooterConfig) ?? { links: [], social: [], copyright_text: "" }}
        contactInfo={(settings?.contact_info as ContactInfo) ?? { email: null, phone: null, address: null }}
        bgColor={bgColor}
        fontColor={fontColor}
      />
    </CartProvider>
  );
}
