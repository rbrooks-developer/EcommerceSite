import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { TawkChat } from "@/components/storefront/TawkChat";
import { Analytics } from "@/components/storefront/Analytics";
import { ogImageUrl } from "@/lib/utils";
import type { ChatConfig, TrackingConfig } from "@/types";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const homepage = settings?.homepage_config as import("@/types").HomepageConfig | null;
  const ogImage = homepage?.og_image_url ?? settings?.logo_url ?? null;
  const faviconUrl = settings?.favicon_url ?? null;
  return {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    title: { default: settings?.site_title ?? "My Store", template: `%s | ${settings?.site_title ?? "My Store"}` },
    description: settings?.meta_description ?? undefined,
    openGraph: {
      type: "website",
      siteName: settings?.site_title ?? "My Store",
      url: process.env.NEXT_PUBLIC_APP_URL ?? "",
      ...(ogImage ? { images: [ogImageUrl(ogImage)] } : {}),
    },
    ...(faviconUrl ? {
      icons: {
        icon: [
          { url: "/api/favicon?size=32",  sizes: "32x32",  type: "image/png" },
          { url: "/api/favicon?size=192", sizes: "192x192", type: "image/png" },
        ],
        apple: [{ url: "/api/favicon?size=180", sizes: "180x180", type: "image/png" }],
        shortcut: [{ url: "/api/favicon?size=32", type: "image/png" }],
      },
    } : {}),
  };
}

const GOOGLE_FONT_FAMILIES = [
  "Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins",
  "Raleway", "Oswald", "Nunito", "DM Sans", "Josefin Sans", "Outfit",
  "Urbanist", "Plus Jakarta Sans", "Figtree", "Mulish", "Quicksand",
  "Playfair Display", "Merriweather", "PT Serif", "Source Sans 3",
  "Lora", "Crimson Text", "EB Garamond", "Libre Baskerville",
  "Bangers", "Comic Neue", "Permanent Marker", "Boogaloo", "Fredoka One",
  "Pacifico", "Caveat", "Patrick Hand", "Indie Flower", "Shadows Into Light",
  "Architects Daughter", "Kalam", "Amatic SC", "Creepster", "Lilita One",
  "Titan One", "Righteous", "Russo One", "Bebas Neue", "Press Start 2P",
];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const settings = await getSettings();
  const homepage   = settings?.homepage_config as import("@/types").HomepageConfig | null;
  const contact    = settings?.contact_info as import("@/types").ContactInfo | null;
  const bgColor    = homepage?.bg_color    ?? "#ffffff";
  const fontColor  = homepage?.font_color  ?? "#111827";
  const fontFamily        = homepage?.font_family          ?? "default";
  const heroFont          = homepage?.hero_font             ?? "Playfair Display";
  const fontGradient      = homepage?.font_gradient_enabled ?? false;
  const faviconUrl        = settings?.favicon_url           ?? null;
  const chatConfig        = (settings as any)?.chat_config as ChatConfig | null;
  const trackingConfig    = (settings as any)?.tracking_config as TrackingConfig | null;

  // Resolve chat visitor — only when chat is actually enabled
  let chatVisitor: { name: string; email: string } | null = null;
  if (chatConfig?.enabled && chatConfig.property_id) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      // Try the default shipping address for first/last name
      const { data: addr } = await supabase
        .from("user_addresses")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .eq("is_default_shipping", true)
        .maybeSingle();

      const name = addr
        ? `${addr.first_name ?? ""} ${addr.last_name ?? ""}`.trim()
        : "";

      chatVisitor = { name: name || user.email, email: user.email };
    }
  }
  const checkoutSectionColor  = homepage?.checkout_section_color   ?? null;
  const checkoutTextboxColor  = homepage?.checkout_textbox_color   ?? null;

  // Same gradient formula as the hero: light → base → dark, driven by fontColor
  const siteGradient = `linear-gradient(180deg, color-mix(in srgb, ${fontColor} 60%, white) 0%, ${fontColor} 50%, color-mix(in srgb, ${fontColor} 70%, black) 100%)`;

  const isGoogleFont   = GOOGLE_FONT_FAMILIES.includes(fontFamily);
  const googleFontUrl  = isGoogleFont
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}&display=swap`
    : null;

  // Hero font is always a Google Font (all options in the picker are Google Fonts)
  const heroFontUrl = heroFont !== fontFamily
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(heroFont)}&display=swap`
    : null;

  const bodyFontFamily = isGoogleFont
    ? `'${fontFamily}', sans-serif`
    : `var(--font-geist-sans), Arial, sans-serif`;

  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      {/* React 19 hoists <link> elements to <head> automatically — no manual <head> wrapper needed */}
      {faviconUrl && <link rel="manifest" href="/api/manifest" />}
      {(googleFontUrl || heroFontUrl) && (
        <>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        </>
      )}
      {googleFontUrl && <link rel="stylesheet" href={googleFontUrl} precedence="default" />}
      {heroFontUrl   && <link rel="stylesheet" href={heroFontUrl}   precedence="default" />}
      <body
        className="min-h-full flex flex-col"
        style={{
          backgroundColor: bgColor,
          color: fontColor,
          fontFamily: bodyFontFamily,
          '--site-fg': fontColor,
          '--site-bg': bgColor,
          '--site-fg-gradient': siteGradient,
          ...(checkoutSectionColor  ? { '--checkout-section-bg':   checkoutSectionColor  } : {}),
          ...(checkoutTextboxColor  ? { '--checkout-input-bg':     checkoutTextboxColor  } : {}),
        } as React.CSSProperties}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: settings?.site_title ?? "My Store",
              url: process.env.NEXT_PUBLIC_APP_URL ?? "",
              ...(settings?.logo_url ? { logo: settings.logo_url } : {}),
              ...(contact?.email || contact?.phone ? {
                contactPoint: {
                  "@type": "ContactPoint",
                  ...(contact.email ? { email: contact.email } : {}),
                  ...(contact.phone ? { telephone: contact.phone } : {}),
                  contactType: "customer service",
                },
              } : {}),
            }).replace(/</g, "\\u003c"),
          }}
        />
        {children}
        {chatVisitor && (
          <TawkChat
            propertyId={chatConfig!.property_id}
            widgetId={chatConfig!.widget_id || "default"}
            visitor={chatVisitor}
          />
        )}
        {(trackingConfig?.ga4_id || trackingConfig?.meta_pixel_id || trackingConfig?.clarity_id) && (
          <Analytics
            ga4_id={trackingConfig.ga4_id}
            meta_pixel_id={trackingConfig.meta_pixel_id}
            clarity_id={trackingConfig.clarity_id}
          />
        )}
      </body>
    </html>
  );
}
