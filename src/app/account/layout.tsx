import type { Metadata } from "next";
import { Header } from "@/components/storefront/Header";
import { Footer } from "@/components/storefront/Footer";
import { CartProvider } from "@/lib/cart/store";
import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import type { NavConfig, FooterConfig, ContactInfo } from "@/types";

export const metadata: Metadata = { title: "My Account" };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [settings, supabase] = await Promise.all([getSettings(), createClient()]);
  const { data: { user } } = await supabase.auth.getUser();

  const isAdmin = user
    ? ((await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle())
        .data as { role: string } | null)?.role === "admin"
    : false;

  const bgColor = (settings as any)?.bg_color ?? "#ffffff";
  const fontColor = (settings as any)?.font_color ?? "#111827";

  return (
    <CartProvider>
      <div style={{ backgroundColor: bgColor, color: fontColor }} className="flex flex-col min-h-full">
        <Header
          siteTitle={settings?.site_title ?? "My Store"}
          logoUrl={settings?.logo_url ?? null}
          navConfig={(settings?.nav_config as NavConfig) ?? { items: [] }}
          isLoggedIn={!!user}
          isAdmin={isAdmin}
        />
        <main className="flex-1">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
        <Footer
          siteTitle={settings?.site_title ?? "My Store"}
          footerConfig={(settings?.footer_config as FooterConfig) ?? { links: [], social: [], copyright_text: "" }}
          contactInfo={(settings?.contact_info as ContactInfo) ?? { email: null, phone: null, address: null }}
        />
      </div>
    </CartProvider>
  );
}
