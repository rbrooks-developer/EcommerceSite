import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { CartProvider } from "@/lib/cart/store";
import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import type { NavConfig, FooterConfig, ContactInfo, HomepageConfig } from "@/types";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [settings, supabase] = await Promise.all([getSettings(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = user
    ? ((await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle())
        .data as { role: string } | null)?.role === "admin"
    : false;

  const homepage = settings?.homepage_config as HomepageConfig | null;
  const bgColor = homepage?.bg_color ?? "#ffffff";
  const fontColor = homepage?.font_color ?? "#111827";
  const fontGradient = homepage?.font_gradient_enabled ?? false;

  return (
    <CartProvider>
      <div {...(fontGradient ? { "data-text-gradient": "true" } : {})} className="min-h-full flex flex-col">
      <Header
        siteTitle={settings?.site_title ?? "My Store"}
        logoUrl={settings?.logo_url ?? null}
        navConfig={(settings?.nav_config as NavConfig) ?? { items: [] }}
        isLoggedIn={!!user}
        isAdmin={isAdmin}
        bgColor={bgColor}
        fontColor={fontColor}
      />
      <main className="flex-1">{children}</main>
      <Footer
        siteTitle={settings?.site_title ?? "My Store"}
        logoUrl={settings?.logo_url ?? null}
        footerConfig={(settings?.footer_config as FooterConfig) ?? { links: [], social: [], copyright_text: "" }}
        contactInfo={(settings?.contact_info as ContactInfo) ?? { email: null, phone: null, address: null }}
        bgColor={bgColor}
        fontColor={fontColor}
      />
      </div>
    </CartProvider>
  );
}
