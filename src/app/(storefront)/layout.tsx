import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { CartProvider } from "@/lib/cart/store";
import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import type { NavConfig, FooterConfig, ContactInfo } from "@/types";

export default async function StorefrontLayout({ children }: { children: React.ReactNode }) {
  const [settings, supabase] = await Promise.all([getSettings(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <CartProvider>
      <Header
        siteTitle={settings?.site_title ?? "My Store"}
        logoUrl={settings?.logo_url ?? null}
        navConfig={(settings?.nav_config as NavConfig) ?? { items: [] }}
        isLoggedIn={!!user}
      />
      <main className="flex-1">{children}</main>
      <Footer
        siteTitle={settings?.site_title ?? "My Store"}
        footerConfig={(settings?.footer_config as FooterConfig) ?? { links: [], social: [], copyright_text: "" }}
        contactInfo={(settings?.contact_info as ContactInfo) ?? { email: null, phone: null, address: null }}
      />
    </CartProvider>
  );
}
