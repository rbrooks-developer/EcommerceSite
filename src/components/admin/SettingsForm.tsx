"use client";

import { useEffect, useRef, useState } from "react";
import { updateSettings } from "@/lib/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { CarouselSettings } from "./CarouselSettings";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/data/countries";
import type { SiteSettings } from "@/types";
import type { HomepageConfig, NavConfig, FooterConfig, ContactInfo, StoreAddress, CarouselConfig, ChatConfig, TrackingConfig, AboutConfig } from "@/types";

const MAX_CAROUSEL_IMAGES = 25;

function ColorPicker({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);

  // Sync text when the color wheel changes the parent value
  useEffect(() => {
    if (/^#[0-9a-fA-F]{6}$/.test(value)) setText(value);
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (/^#[0-9a-fA-F]{0,6}$/.test(v)) {
      setText(v);
      if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
    }
  };

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#ffffff"}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 cursor-pointer rounded-md border border-gray-300 p-1 bg-white"
        />
        <input
          id={id}
          type="text"
          value={text}
          onChange={handleTextChange}
          className="flex h-11 w-28 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-gray-900"
          maxLength={7}
          placeholder="#ffffff"
        />
      </div>
    </div>
  );
}

function FaviconUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setError(null);
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "png";
    const path = `site/favicon-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("site-assets")
      .upload(path, file, { upsert: true });
    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("site-assets").getPublicUrl(path);
    onChange(data.publicUrl);
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        {value && (
          <div className="h-10 w-10 rounded border border-gray-200 bg-gray-50 p-1 flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Favicon" className="h-full w-full object-contain" />
          </div>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {uploading && <Spinner className="h-3.5 w-3.5" />}
          {uploading ? "Uploading…" : value ? "Change" : "Browse…"}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-sm text-red-500 hover:text-red-700"
          >
            Remove
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".ico,.png,.svg,.webp,image/x-icon,image/png,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
      <h2 className="font-semibold text-gray-900 text-base">{title}</h2>
      {children}
    </div>
  );
}

interface Props {
  defaultValues: SiteSettings | null;
  products: { id: string; name: string }[];
  categories: { id: string; name: string }[];
}

export function SettingsForm({ defaultValues, products, categories }: Props) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showSitePassword, setShowSitePassword] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string[]>(defaultValues?.logo_url ? [defaultValues.logo_url] : []);
  const [logoSpinHeader, setLogoSpinHeader] = useState<boolean>(!!(defaultValues as any)?.logo_spin_header);
  const [logoSpinHero, setLogoSpinHero] = useState<boolean>(!!(defaultValues as any)?.logo_spin_hero);
  const [logoSpinFooter, setLogoSpinFooter] = useState<boolean>(!!(defaultValues as any)?.logo_spin_footer);
  const [faviconUrl, setFaviconUrl] = useState<string[]>(defaultValues?.favicon_url ? [defaultValues.favicon_url] : []);

  const homepage = defaultValues?.homepage_config as HomepageConfig | null;

  const [bgColor, setBgColor] = useState(homepage?.bg_color ?? "#ffffff");
  const [fontColor, setFontColor] = useState(homepage?.font_color ?? "#111827");
  const [fontFamily, setFontFamily] = useState(homepage?.font_family ?? "default");
  const [heroFont, setHeroFont] = useState(homepage?.hero_font ?? "Playfair Display");
  const [fontGradient, setFontGradient] = useState(homepage?.font_gradient_enabled ?? false);
  const [checkoutSectionColor, setCheckoutSectionColor] = useState(homepage?.checkout_section_color ?? "#1a1a1a");
  const [productDetailBgColor, setProductDetailBgColor] = useState<string>((homepage as any)?.product_detail_bg_color ?? "");
  const [checkoutTextboxColor, setCheckoutTextboxColor] = useState(homepage?.checkout_textbox_color ?? "#2a2a2a");
  const [striationUrl, setStriationUrl] = useState<string[]>(homepage?.striation_image_url ? [homepage.striation_image_url] : []);
  const [striationOpacity, setStriationOpacity] = useState(homepage?.striation_opacity ?? 30);
  const [striationBlendMode, setStriationBlendMode] = useState(homepage?.striation_blend_mode ?? "screen");
  const [striationPosition, setStriationPosition] = useState(homepage?.striation_position ?? "full");

  useEffect(() => {
    const id = "admin-font-preview-link";
    document.getElementById(id)?.remove();
    if (!fontFamily || fontFamily === "default") return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}&display=swap`;
    document.head.appendChild(link);
  }, [fontFamily]);

  useEffect(() => {
    const id = "admin-hero-font-preview-link";
    document.getElementById(id)?.remove();
    if (!heroFont) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(heroFont)}&display=swap`;
    document.head.appendChild(link);
  }, [heroFont]);

  const [taxMode, setTaxMode] = useState(defaultValues?.tax_mode ?? "none");

  const nav = defaultValues?.nav_config as NavConfig | null;
  const footer = defaultValues?.footer_config as FooterConfig | null;
  const contact = defaultValues?.contact_info as ContactInfo | null;
  const storeAddress = defaultValues?.store_address as StoreAddress | null;

  const savedCountries = (defaultValues as any)?.shipping_countries as string[] | null;
  const [shippingCountries, setShippingCountries] = useState<string[]>(savedCountries ?? ["US"]);

  const [navItems, setNavItems] = useState(nav?.items ?? [{ label: "", link: "" }]);
  const [footerLinks, setFooterLinks] = useState(footer?.links ?? [{ label: "", link: "" }]);
  const [socialLinks, setSocialLinks] = useState(footer?.social ?? [{ platform: "", url: "" }]);
  const [featuredProducts, setFeaturedProducts] = useState<string[]>(homepage?.featured_product_ids ?? []);
  const [featuredCategories, setFeaturedCategories] = useState<string[]>(homepage?.featured_category_ids ?? []);
  const [serviceImages, setServiceImages] = useState<string[]>(homepage?.service_images ?? []);
  const [ogImageUrl, setOgImageUrl] = useState<string[]>(homepage?.og_image_url ? [homepage.og_image_url] : []);
  const [carouselConfig, setCarouselConfig] = useState<CarouselConfig>(
    homepage?.carousel ?? { images: [], speed: 40, direction: "left", height: 280, gap: 16, image_fit: "contain", image_padding: 0, border_radius: 8, pause_on_hover: true, fade_edges: true }
  );

  const aboutCfg = (defaultValues as any)?.about_config as AboutConfig | null;
  const [aboutHeading1, setAboutHeading1] = useState(aboutCfg?.heading1 ?? "About Us");
  const [aboutBody1, setAboutBody1] = useState(aboutCfg?.body1 ?? "");
  const [aboutImage1, setAboutImage1] = useState<string[]>(aboutCfg?.image1_url ? [aboutCfg.image1_url] : []);
  const [aboutHeading2, setAboutHeading2] = useState(aboutCfg?.heading2 ?? "Our Mission");
  const [aboutBody2, setAboutBody2] = useState(aboutCfg?.body2 ?? "");
  const [aboutImage2, setAboutImage2] = useState<string[]>(aboutCfg?.image2_url ? [aboutCfg.image2_url] : []);

  const savedChat = (defaultValues as any)?.chat_config as ChatConfig | null;
  const [chatEnabled, setChatEnabled] = useState(savedChat?.enabled ?? false);
  const [chatPropertyId, setChatPropertyId] = useState(savedChat?.property_id ?? "");
  const [chatWidgetId, setChatWidgetId] = useState(savedChat?.widget_id ?? "default");

  const savedTracking = (defaultValues as any)?.tracking_config as TrackingConfig | null;
  const [ga4Id, setGa4Id] = useState(savedTracking?.ga4_id ?? "");
  const [metaPixelId, setMetaPixelId] = useState(savedTracking?.meta_pixel_id ?? "");
  const [clarityId, setClarityId] = useState(savedTracking?.clarity_id ?? "");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const form = e.currentTarget;
    const g = (name: string) => (form.elements.namedItem(name) as HTMLInputElement)?.value ?? "";

    const result = await updateSettings({
      site_password: g("site_password") || null,
      site_title: g("site_title"),
      meta_title: g("meta_title") || undefined,
      meta_description: g("meta_description") || undefined,
      logo_url: logoUrl[0] ?? null,
      logo_spin_header: logoSpinHeader,
      logo_spin_hero: logoSpinHero,
      logo_spin_footer: logoSpinFooter,
      favicon_url: faviconUrl[0] ?? null,
      tax_mode: taxMode as "stripe" | "flat_rate" | "none",
      tax_flat_rate: taxMode === "flat_rate" ? parseFloat(g("tax_flat_rate")) : undefined,
      homepage_config: {
        hero_heading: g("hero_heading"),
        hero_subtext: g("hero_subtext"),
        hero_image_url: g("hero_image_url") || undefined,
        hero_cta_text: g("hero_cta_text"),
        hero_cta_link: g("hero_cta_link"),
        featured_product_ids: featuredProducts,
        featured_category_ids: featuredCategories,
        banners: [],
        bg_color: bgColor,
        font_color: fontColor,
        font_family: fontFamily,
        font_gradient_enabled: fontGradient,
        hero_display_name: g("hero_display_name") || undefined,
        hero_tagline: g("hero_tagline") || undefined,
        hero_font: heroFont || "Playfair Display",
        service_images: serviceImages,
        og_image_url: ogImageUrl[0] ?? null,
        checkout_section_color: checkoutSectionColor,
        product_detail_bg_color: productDetailBgColor || null,
        checkout_textbox_color: checkoutTextboxColor,
        striation_image_url: striationUrl[0] ?? null,
        striation_opacity: striationOpacity,
        striation_blend_mode: striationBlendMode,
        striation_position: striationPosition,
        carousel: carouselConfig,
      },
      nav_config: { items: navItems.filter((i) => i.label && i.link) },
      footer_config: {
        links: footerLinks.filter((l) => l.label && l.link),
        social: socialLinks.filter((s) => s.platform && s.url),
        copyright_text: g("copyright_text"),
        display_name: g("footer_display_name") || undefined,
        tagline: g("footer_tagline") || undefined,
        social_handle: g("social_handle") || undefined,
      },
      contact_info: {
        email: g("contact_email") || undefined,
        phone: g("contact_phone") || undefined,
      },
      chat_config: { enabled: chatEnabled, property_id: chatPropertyId, widget_id: chatWidgetId || "default" },
      tracking_config: {
        ga4_id: ga4Id || null,
        meta_pixel_id: metaPixelId || null,
        clarity_id: clarityId || null,
      },
      handling_fee: parseFloat(g("handling_fee")) || 0,
      insurance_min_subtotal: parseFloat(g("insurance_min_subtotal")) || 0,
      signature_min_subtotal: parseFloat(g("signature_min_subtotal")) || 0,
      about_config: {
        heading1: aboutHeading1,
        body1: aboutBody1,
        image1_url: aboutImage1[0] ?? null,
        heading2: aboutHeading2,
        body2: aboutBody2,
        image2_url: aboutImage2[0] ?? null,
      },
      shipping_countries: shippingCountries,
      store_address: {
        name: g("store_name"),
        street1: g("store_street1"),
        street2: g("store_street2") || undefined,
        city: g("store_city"),
        state: g("store_state"),
        zip: g("store_zip"),
        country: g("store_country") || "US",
        phone: g("store_phone") || undefined,
      },
    });

    setSaving(false);
    if (result && "error" in result) {
      setMessage({ type: "error", text: "Failed to save settings. Check all required fields." });
    } else {
      setMessage({ type: "success", text: "Settings saved successfully." });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-8 items-start pb-10">
      {/* Sticky left column — title + save button */}
      <div className="hidden lg:flex flex-col gap-3 w-48 shrink-0 sticky top-0 -mt-4 md:-mt-6 lg:-mt-8 pt-4 md:pt-6 lg:pt-8">
        <h1 className="text-2xl font-bold text-gray-900">Site Settings</h1>
        <Button type="submit" size="lg" className="w-full" loading={saving}>Save Settings</Button>
        {message && (
          <div className={`rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
            {message.text}
          </div>
        )}
      </div>

      {/* Sections — right column */}
      <div className="flex-1 min-w-0 space-y-5">
      {message && (
        <div className={`lg:hidden rounded-md p-3 text-sm ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      <Section title="General">
        <div><Label htmlFor="site_title" required>Site Title</Label><Input id="site_title" name="site_title" defaultValue={defaultValues?.site_title ?? ""} required /></div>
        <div>
          <Label htmlFor="site_password">Site Password <span className="text-gray-400 font-normal">(leave blank to disable — visitors must enter this to access the site)</span></Label>
          <div className="relative mt-1">
            <Input
              id="site_password"
              name="site_password"
              type={showSitePassword ? "text" : "password"}
              defaultValue={(defaultValues as any)?.site_password ?? ""}
              placeholder="Leave blank for no password"
              className="pr-20"
            />
            <button
              type="button"
              onClick={() => setShowSitePassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-800"
            >
              {showSitePassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div><Label htmlFor="meta_title">Meta Title <span className="text-gray-400 font-normal">(max 60 chars)</span></Label><Input id="meta_title" name="meta_title" maxLength={60} defaultValue={defaultValues?.meta_title ?? ""} /></div>
        <div><Label htmlFor="meta_description">Meta Description <span className="text-gray-400 font-normal">(max 160 chars)</span></Label><Textarea id="meta_description" name="meta_description" maxLength={160} rows={2} defaultValue={defaultValues?.meta_description ?? ""} /></div>
        <div>
          <Label>Logo</Label>
          <ImageUpload value={logoUrl} onChange={setLogoUrl} max={1} />
          <div className="mt-2 flex flex-wrap gap-4">
            {([
              ["Header", logoSpinHeader, setLogoSpinHeader],
              ["Hero", logoSpinHero, setLogoSpinHero],
              ["Footer", logoSpinFooter, setLogoSpinFooter],
            ] as [string, boolean, (v: boolean) => void][]).map(([label, checked, setter]) => (
              <label key={label} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setter(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700">Spin in {label}</span>
              </label>
            ))}
          </div>
        </div>
        <div><Label>Favicon <span className="text-gray-400 font-normal">(.ico, .png, .svg, .webp)</span></Label><ImageUpload value={faviconUrl} onChange={setFaviconUrl} max={1} bucket="site-assets" pathPrefix="site" /></div>
        <div>
          <Label>OG Image <span className="text-gray-400 font-normal">(shared preview image for social media — recommended 1200×630)</span></Label>
          <ImageUpload value={ogImageUrl} onChange={setOgImageUrl} max={1} bucket="site-assets" pathPrefix="og" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorPicker id="bg_color" label="Background Color" value={bgColor} onChange={setBgColor} />
          <ColorPicker id="font_color" label="Font Color" value={fontColor} onChange={setFontColor} />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={fontGradient}
            onClick={() => setFontGradient((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${fontGradient ? "bg-gray-900 dark:bg-emerald-500" : "bg-gray-200 dark:bg-gray-600"}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${fontGradient ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <div>
            <p className="text-sm font-medium text-gray-900">Gradient text color</p>
            <p className="text-xs text-gray-500">Apply a light-to-dark gradient to headings and text using the font color as the base</p>
          </div>
        </div>
        <div>
          <Label htmlFor="font_family">Font Family</Label>
          <select
            id="font_family"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="mt-1 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="default">Default (Geist)</option>
            <optgroup label="Sans-serif">
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Lato">Lato</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Poppins">Poppins</option>
              <option value="Raleway">Raleway</option>
              <option value="Nunito">Nunito</option>
              <option value="DM Sans">DM Sans</option>
              <option value="Josefin Sans">Josefin Sans</option>
              <option value="Oswald">Oswald</option>
              <option value="Outfit">Outfit</option>
              <option value="Urbanist">Urbanist</option>
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              <option value="Figtree">Figtree</option>
              <option value="Mulish">Mulish</option>
              <option value="Quicksand">Quicksand</option>
            </optgroup>
            <optgroup label="Serif">
              <option value="Playfair Display">Playfair Display</option>
              <option value="Merriweather">Merriweather</option>
              <option value="PT Serif">PT Serif</option>
              <option value="Source Sans 3">Source Sans 3</option>
              <option value="Lora">Lora</option>
              <option value="Crimson Text">Crimson Text</option>
              <option value="EB Garamond">EB Garamond</option>
              <option value="Libre Baskerville">Libre Baskerville</option>
            </optgroup>
            <optgroup label="Comic &amp; Display">
              <option value="Bangers">Bangers</option>
              <option value="Comic Neue">Comic Neue</option>
              <option value="Boogaloo">Boogaloo</option>
              <option value="Fredoka One">Fredoka One</option>
              <option value="Lilita One">Lilita One</option>
              <option value="Titan One">Titan One</option>
              <option value="Creepster">Creepster</option>
              <option value="Righteous">Righteous</option>
              <option value="Russo One">Russo One</option>
              <option value="Bebas Neue">Bebas Neue</option>
              <option value="Amatic SC">Amatic SC</option>
              <option value="Press Start 2P">Press Start 2P</option>
            </optgroup>
            <optgroup label="Handwritten">
              <option value="Permanent Marker">Permanent Marker</option>
              <option value="Pacifico">Pacifico</option>
              <option value="Caveat">Caveat</option>
              <option value="Patrick Hand">Patrick Hand</option>
              <option value="Indie Flower">Indie Flower</option>
              <option value="Shadows Into Light">Shadows Into Light</option>
              <option value="Architects Daughter">Architects Daughter</option>
              <option value="Kalam">Kalam</option>
            </optgroup>
          </select>
          <p
            className="mt-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-800"
            style={{ fontFamily: fontFamily !== "default" ? `'${fontFamily}', sans-serif` : undefined }}
          >
            The quick brown fox jumps over the lazy dog
          </p>
        </div>
      </Section>

      <Section title="Hero">
        <div>
          <Label htmlFor="hero_display_name">Display Name <span className="text-gray-400 font-normal">(large title text on homepage)</span></Label>
          <Input id="hero_display_name" name="hero_display_name" defaultValue={homepage?.hero_display_name ?? ""} placeholder="e.g. Business Name" />
        </div>
        <div>
          <Label htmlFor="hero_tagline">Tagline <span className="text-gray-400 font-normal">(small text below title)</span></Label>
          <Input id="hero_tagline" name="hero_tagline" defaultValue={homepage?.hero_tagline ?? ""} placeholder="e.g. Faith. Purpose. Story." />
        </div>
        <div>
          <Label htmlFor="hero_font">Hero Title Font</Label>
          <select
            id="hero_font"
            value={heroFont}
            onChange={(e) => setHeroFont(e.target.value)}
            className="mt-1 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <optgroup label="Sans-serif">
              <option value="Inter">Inter</option>
              <option value="Roboto">Roboto</option>
              <option value="Open Sans">Open Sans</option>
              <option value="Lato">Lato</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Poppins">Poppins</option>
              <option value="Raleway">Raleway</option>
              <option value="Nunito">Nunito</option>
              <option value="DM Sans">DM Sans</option>
              <option value="Josefin Sans">Josefin Sans</option>
              <option value="Oswald">Oswald</option>
              <option value="Outfit">Outfit</option>
              <option value="Urbanist">Urbanist</option>
              <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              <option value="Figtree">Figtree</option>
              <option value="Mulish">Mulish</option>
              <option value="Quicksand">Quicksand</option>
            </optgroup>
            <optgroup label="Serif">
              <option value="Playfair Display">Playfair Display</option>
              <option value="Merriweather">Merriweather</option>
              <option value="PT Serif">PT Serif</option>
              <option value="Source Sans 3">Source Sans 3</option>
              <option value="Lora">Lora</option>
              <option value="Crimson Text">Crimson Text</option>
              <option value="EB Garamond">EB Garamond</option>
              <option value="Libre Baskerville">Libre Baskerville</option>
            </optgroup>
            <optgroup label="Comic &amp; Display">
              <option value="Bangers">Bangers</option>
              <option value="Comic Neue">Comic Neue</option>
              <option value="Boogaloo">Boogaloo</option>
              <option value="Fredoka One">Fredoka One</option>
              <option value="Lilita One">Lilita One</option>
              <option value="Titan One">Titan One</option>
              <option value="Creepster">Creepster</option>
              <option value="Righteous">Righteous</option>
              <option value="Russo One">Russo One</option>
              <option value="Bebas Neue">Bebas Neue</option>
              <option value="Amatic SC">Amatic SC</option>
              <option value="Press Start 2P">Press Start 2P</option>
            </optgroup>
            <optgroup label="Handwritten">
              <option value="Permanent Marker">Permanent Marker</option>
              <option value="Pacifico">Pacifico</option>
              <option value="Caveat">Caveat</option>
              <option value="Patrick Hand">Patrick Hand</option>
              <option value="Indie Flower">Indie Flower</option>
              <option value="Shadows Into Light">Shadows Into Light</option>
              <option value="Architects Daughter">Architects Daughter</option>
              <option value="Kalam">Kalam</option>
            </optgroup>
          </select>
          <p
            className="mt-2 rounded border border-gray-200 bg-gray-50 px-3 py-2 text-base text-gray-800"
            style={{ fontFamily: `'${heroFont}', serif` }}
          >
            The quick brown fox jumps over the lazy dog
          </p>
        </div>
      </Section>

      <Section title="Services">
        <p className="text-sm text-gray-500">Upload up to 3 images for the Services section on the homepage. With 2–3 images they display side-by-side; a single image shows at natural size centered.</p>
        <ImageUpload
          value={serviceImages}
          onChange={setServiceImages}
          max={3}
          bucket="site-assets"
          pathPrefix="services"
        />
      </Section>

      <Section title="About Us">
        <p className="text-sm text-gray-500">
          Content for the <code className="bg-gray-100 px-1 rounded text-xs">/about</code> page. Two blocks — the first shows text on the left and image on the right; the second flips to image left, text right. Fields are optional; leave any blank to hide it.
        </p>

        <div className="space-y-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Block 1 — text left · image right</p>
          <div>
            <Label htmlFor="about_heading1">Heading</Label>
            <input
              id="about_heading1"
              type="text"
              value={aboutHeading1}
              onChange={(e) => setAboutHeading1(e.target.value)}
              placeholder="About Us"
              className="mt-1 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <Label htmlFor="about_body1">Body Text</Label>
            <Textarea
              id="about_body1"
              value={aboutBody1}
              onChange={(e) => setAboutBody1(e.target.value)}
              placeholder="Tell your story…"
              rows={4}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Image</Label>
            <ImageUpload value={aboutImage1} onChange={setAboutImage1} max={1} bucket="site-assets" pathPrefix="about" />
          </div>
        </div>

        <div className="space-y-4 border-t border-gray-100 pt-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Block 2 — image left · text right</p>
          <div>
            <Label htmlFor="about_heading2">Heading</Label>
            <input
              id="about_heading2"
              type="text"
              value={aboutHeading2}
              onChange={(e) => setAboutHeading2(e.target.value)}
              placeholder="Our Mission"
              className="mt-1 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <Label htmlFor="about_body2">Body Text</Label>
            <Textarea
              id="about_body2"
              value={aboutBody2}
              onChange={(e) => setAboutBody2(e.target.value)}
              placeholder="Share your mission…"
              rows={4}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Image</Label>
            <ImageUpload value={aboutImage2} onChange={setAboutImage2} max={1} bucket="site-assets" pathPrefix="about" />
          </div>
        </div>
      </Section>

      <Section title="Carousel">
        <p className="text-sm text-gray-500">
          A scrolling strip of images that appears between the hero and your content sections. Supports up to {MAX_CAROUSEL_IMAGES} images. Leave empty to hide.
        </p>
        <CarouselSettings value={carouselConfig} onChange={setCarouselConfig} />
      </Section>

      <Section title="Cart / Checkout / Account / Login / Register / Forgot Password">
        <p className="text-sm text-gray-500">Colors for the cart, checkout, and account pages.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorPicker id="checkout_section_color" label="Section Color" value={checkoutSectionColor} onChange={setCheckoutSectionColor} />
          <ColorPicker id="checkout_textbox_color" label="Textbox Color" value={checkoutTextboxColor} onChange={setCheckoutTextboxColor} />
        </div>
        <p className="text-xs text-gray-400">Section Color = background of panels/cards. Textbox Color = background of input fields and dropdowns.</p>

        <div className="border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500 mb-3">Color for the background behind the main product image on product detail pages. Leave unset to keep it transparent.</p>
          <div className="flex items-end gap-3">
            <ColorPicker
              id="product_detail_bg_color"
              label="Product Detail Background Color"
              value={productDetailBgColor || "#ffffff"}
              onChange={setProductDetailBgColor}
            />
            {productDetailBgColor && (
              <button
                type="button"
                onClick={() => setProductDetailBgColor("")}
                className="mb-0.5 text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 whitespace-nowrap"
              >
                Reset to transparent
              </button>
            )}
          </div>
          {!productDetailBgColor && (
            <p className="mt-1.5 text-xs text-gray-400">Currently transparent — pick a color above to activate.</p>
          )}
        </div>
      </Section>

      <Section title="Background Overlay">
        <p className="text-sm text-gray-500">Upload a texture or striation image to overlay on every page background. Adjust opacity and blend mode to taste — <strong>Screen</strong> works best for light streaks on a dark background.</p>
        <div>
          <Label>Overlay Image</Label>
          <ImageUpload value={striationUrl} onChange={setStriationUrl} max={1} bucket="site-assets" pathPrefix="overlay" />
        </div>
        {striationUrl[0] && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="striation_blend_mode">Blend Mode</Label>
                <select
                  id="striation_blend_mode"
                  value={striationBlendMode}
                  onChange={(e) => setStriationBlendMode(e.target.value)}
                  className="mt-1 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="screen">Screen (light streaks on dark)</option>
                  <option value="overlay">Overlay (contrast boost)</option>
                  <option value="normal">Normal (plain opacity)</option>
                  <option value="multiply">Multiply (darkens)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="striation_position">Position</Label>
                <select
                  id="striation_position"
                  value={striationPosition}
                  onChange={(e) => setStriationPosition(e.target.value)}
                  className="mt-1 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  <option value="full">Full (cover entire background)</option>
                  <option value="left">Left side</option>
                  <option value="right">Right side</option>
                  <option value="tile">Tiled (repeat)</option>
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor="striation_opacity">Opacity: {striationOpacity}%</Label>
              <input
                id="striation_opacity"
                type="range"
                min="0"
                max="100"
                value={striationOpacity}
                onChange={(e) => setStriationOpacity(Number(e.target.value))}
                className="mt-1 w-full accent-gray-900"
              />
            </div>
            <div className="rounded-md overflow-hidden border border-gray-200">
              <p className="text-xs text-gray-400 bg-gray-50 px-2 py-1 border-b border-gray-200">Preview</p>
              <div className="h-24 relative" style={{ backgroundColor: bgColor }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    backgroundImage: `url(${striationUrl[0]})`,
                    backgroundSize: striationPosition === "full" ? "cover" : striationPosition === "tile" ? "auto" : "auto 100%",
                    backgroundPosition: striationPosition === "left" ? "left center" : striationPosition === "right" ? "right center" : "center",
                    backgroundRepeat: striationPosition === "tile" ? "repeat" : "no-repeat",
                    opacity: striationOpacity / 100,
                    mixBlendMode: striationBlendMode as React.CSSProperties["mixBlendMode"],
                  }}
                />
              </div>
            </div>
          </>
        )}
      </Section>

      {/* Homepage section hidden — not currently in use
      <Section title="Homepage">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label htmlFor="hero_heading">Hero Heading</Label><Input id="hero_heading" name="hero_heading" defaultValue={homepage?.hero_heading ?? ""} /></div>
          <div><Label htmlFor="hero_subtext">Hero Subtext</Label><Input id="hero_subtext" name="hero_subtext" defaultValue={homepage?.hero_subtext ?? ""} /></div>
          <div><Label htmlFor="hero_image_url">Hero Image URL</Label><Input id="hero_image_url" name="hero_image_url" type="url" defaultValue={homepage?.hero_image_url ?? ""} /></div>
          <div><Label htmlFor="hero_cta_text">CTA Button Text</Label><Input id="hero_cta_text" name="hero_cta_text" defaultValue={homepage?.hero_cta_text ?? "Shop Now"} /></div>
          <div><Label htmlFor="hero_cta_link">CTA Button Link</Label><Input id="hero_cta_link" name="hero_cta_link" defaultValue={homepage?.hero_cta_link ?? "/products"} /></div>
        </div>
        <div>
          <Label>Featured Products</Label>
          <select multiple value={featuredProducts} onChange={(e) => setFeaturedProducts(Array.from(e.target.selectedOptions, (o) => o.value))} className="w-full h-32 rounded-md border border-gray-300 p-2 text-sm">
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <p className="text-xs text-gray-400 mt-1">Ctrl/Cmd+click to select multiple</p>
        </div>
        <div>
          <Label>Featured Categories</Label>
          <select multiple value={featuredCategories} onChange={(e) => setFeaturedCategories(Array.from(e.target.selectedOptions, (o) => o.value))} className="w-full h-24 rounded-md border border-gray-300 p-2 text-sm">
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </Section>
      */}

      <Section title="Navigation">
        <div className="space-y-2">
          {navItems.map((item, i) => (
            <div key={i} className="flex gap-2">
              <Input value={item.label} onChange={(e) => setNavItems((prev) => prev.map((n, idx) => idx === i ? { ...n, label: e.target.value } : n))} placeholder="Label (e.g. Shop)" />
              <Input value={item.link} onChange={(e) => setNavItems((prev) => prev.map((n, idx) => idx === i ? { ...n, link: e.target.value } : n))} placeholder="Link (e.g. /products)" />
              <button type="button" onClick={() => setNavItems((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-red-500 hover:text-red-700 px-2">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setNavItems((prev) => [...prev, { label: "", link: "" }])} className="text-sm text-blue-600 hover:underline">+ Add nav item</button>
        </div>
      </Section>

      <Section title="Footer">
        <div>
          <Label>Footer Links</Label>
          <div className="space-y-2">
            {footerLinks.map((link, i) => (
              <div key={i} className="flex gap-2">
                <Input value={link.label} onChange={(e) => setFooterLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, label: e.target.value } : l))} placeholder="Label" />
                <Input value={link.link} onChange={(e) => setFooterLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, link: e.target.value } : l))} placeholder="URL" />
                <button type="button" onClick={() => setFooterLinks((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-red-500 px-2">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setFooterLinks((prev) => [...prev, { label: "", link: "" }])} className="text-sm text-blue-600 hover:underline">+ Add link</button>
          </div>
        </div>
        <div>
          <Label>Social Media</Label>
          <div className="space-y-2">
            {socialLinks.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input value={s.platform} onChange={(e) => setSocialLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, platform: e.target.value } : l))} placeholder="Platform (e.g. Instagram)" />
                <Input value={s.url} onChange={(e) => setSocialLinks((prev) => prev.map((l, idx) => idx === i ? { ...l, url: e.target.value } : l))} placeholder="URL" />
                <button type="button" onClick={() => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 text-red-500 px-2">✕</button>
              </div>
            ))}
            <button type="button" onClick={() => setSocialLinks((prev) => [...prev, { platform: "", url: "" }])} className="text-sm text-blue-600 hover:underline">+ Add social</button>
          </div>
        </div>
        <div><Label htmlFor="footer_display_name">Display Name <span className="text-gray-400 font-normal">(name shown large in footer, e.g. your name)</span></Label><Input id="footer_display_name" name="footer_display_name" defaultValue={footer?.display_name ?? ""} placeholder="Alexi Samaan" /></div>
        <div><Label htmlFor="footer_tagline">Tagline / Subtitle <span className="text-gray-400 font-normal">(shown under display name)</span></Label><Input id="footer_tagline" name="footer_tagline" defaultValue={footer?.tagline ?? ""} placeholder="Founder &amp; Creator" /></div>
        <div><Label htmlFor="social_handle">Social Handle <span className="text-gray-400 font-normal">(e.g. @MyBrand)</span></Label><Input id="social_handle" name="social_handle" defaultValue={footer?.social_handle ?? ""} placeholder="@MyBrand" /></div>
        <div><Label htmlFor="copyright_text">Copyright Text</Label><Input id="copyright_text" name="copyright_text" defaultValue={footer?.copyright_text ?? ""} placeholder={`© ${new Date().getFullYear()} My Store`} /></div>
      </Section>

      <Section title="Contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label htmlFor="contact_email">Email</Label><Input id="contact_email" name="contact_email" type="email" defaultValue={contact?.email ?? ""} /></div>
          <div><Label htmlFor="contact_phone">Phone</Label><Input id="contact_phone" name="contact_phone" defaultValue={contact?.phone ?? ""} /></div>
        </div>
      </Section>

      <Section title="Live Chat">
        <p className="text-sm text-gray-500">
          Powered by{" "}
          <a href="https://www.tawk.to" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-700">
            Tawk.to
          </a>{" "}
          (free). Get your IDs from the Tawk.to dashboard under{" "}
          <strong>Administration → Channels → Chat Widget → Installation</strong>.
        </p>

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={chatEnabled}
            onClick={() => setChatEnabled((v) => !v)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${chatEnabled ? "bg-gray-900 dark:bg-emerald-500" : "bg-gray-200 dark:bg-gray-600"}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${chatEnabled ? "translate-x-5" : "translate-x-0"}`} />
          </button>
          <span className="text-sm font-medium text-gray-900">
            {chatEnabled ? "Chat widget enabled" : "Chat widget disabled (hidden from visitors)"}
          </span>
        </div>

        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 transition-opacity ${chatEnabled ? "opacity-100" : "opacity-40 pointer-events-none"}`}>
          <div>
            <Label htmlFor="chat_property_id">Property ID</Label>
            <Input
              id="chat_property_id"
              value={chatPropertyId}
              onChange={(e) => setChatPropertyId(e.target.value)}
              placeholder="e.g. 64abc123abc123abc123abc1"
              disabled={!chatEnabled}
            />
          </div>
          <div>
            <Label htmlFor="chat_widget_id">Widget ID</Label>
            <Input
              id="chat_widget_id"
              value={chatWidgetId}
              onChange={(e) => setChatWidgetId(e.target.value)}
              placeholder="e.g. default or 1abc123ab"
              disabled={!chatEnabled}
            />
          </div>
        </div>
      </Section>

      <Section title="Analytics &amp; Tracking">
        <p className="text-sm text-gray-500">
          Leave any field blank to disable that service. IDs are never shared with visitors — they only appear in the page source after you save.
        </p>

        {/* Google Analytics 4 */}
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-start gap-4 p-4 border-l-4" style={{ borderLeftColor: "#E37400" }}>
            <div className="shrink-0 mt-0.5">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <rect x="0" y="18" width="10" height="18" rx="2" fill="#FBBC04"/>
                <rect x="13" y="10" width="10" height="26" rx="2" fill="#34A853"/>
                <rect x="26" y="2" width="10" height="34" rx="2" fill="#EA4335"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">Google Analytics 4</span>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-green-600/20">Free</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                The industry standard for understanding your traffic — where visitors come from, which pages they view, how long they stay, and how many become buyers. Connects directly to Google Search Console and Google Ads.
              </p>
              <div>
                <Label htmlFor="ga4_id">Measurement ID</Label>
                <Input
                  id="ga4_id"
                  value={ga4Id}
                  onChange={(e) => setGa4Id(e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="mt-1 font-mono"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Format: <code className="bg-gray-100 px-1 rounded">G-XXXXXXXXXX</code> · Find yours in{" "}
                  <a href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                    Google Analytics
                  </a>{" "}
                  → Admin → Data Streams → your stream → Measurement ID
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Meta Pixel */}
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-start gap-4 p-4 border-l-4" style={{ borderLeftColor: "#0866FF" }}>
            <div className="shrink-0 mt-0.5">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <circle cx="18" cy="18" r="18" fill="#0866FF"/>
                <path d="M20.5 18.5h-3v10.5H14V18.5h-2v-3.5h2v-2.2C14 10.1 15.4 8.5 18.5 8.5H21V12h-1.8c-1 0-1.2.4-1.2 1.2V15h3.1l-.6 3.5z" fill="white"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">Meta Pixel</span>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-green-600/20">Free</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Required if you run Facebook or Instagram ads. Tracks purchases, add-to-cart events, and page views so Meta&apos;s algorithm can optimize your campaigns and build look-alike audiences from real buyers.
              </p>
              <div>
                <Label htmlFor="meta_pixel_id">Pixel ID</Label>
                <Input
                  id="meta_pixel_id"
                  value={metaPixelId}
                  onChange={(e) => setMetaPixelId(e.target.value)}
                  placeholder="123456789012345"
                  className="mt-1 font-mono"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Format: 15–16 digit number · Find yours in{" "}
                  <a href="https://business.facebook.com/events_manager" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                    Meta Events Manager
                  </a>{" "}
                  → your pixel → Settings
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Microsoft Clarity */}
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-start gap-4 p-4 border-l-4" style={{ borderLeftColor: "#512BD4" }}>
            <div className="shrink-0 mt-0.5">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
                <rect width="36" height="36" rx="8" fill="#512BD4"/>
                <ellipse cx="18" cy="18" rx="13" ry="8" stroke="white" strokeWidth="2.2" fill="none"/>
                <circle cx="18" cy="18" r="4.5" fill="white"/>
                <circle cx="18" cy="18" r="2.2" fill="#512BD4"/>
                <circle cx="21.5" cy="14.5" r="1.2" fill="white"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-900">Microsoft Clarity</span>
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700 ring-1 ring-green-600/20">Free</span>
                <span className="inline-flex items-center rounded-full bg-purple-50 px-2 py-0.5 text-[11px] font-medium text-purple-700 ring-1 ring-purple-600/20">Session Recording</span>
              </div>
              <p className="text-sm text-gray-500 mb-3">
                Watch real visitors navigate your store — where they click, scroll, and get confused. Heatmaps and session recordings reveal friction points that GA numbers can&apos;t. Completely free with no traffic limits.
              </p>
              <div>
                <Label htmlFor="clarity_id">Project ID</Label>
                <Input
                  id="clarity_id"
                  value={clarityId}
                  onChange={(e) => setClarityId(e.target.value)}
                  placeholder="abc12def"
                  className="mt-1 font-mono"
                />
                <p className="mt-1.5 text-xs text-gray-400">
                  Format: 8-char alphanumeric · Find yours in{" "}
                  <a href="https://clarity.microsoft.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-gray-600">
                    Microsoft Clarity
                  </a>{" "}
                  → your project → Settings → Tracking Code
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Store Address (for EasyPost shipping rates)">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><Label htmlFor="store_name" required>Store Name</Label><Input id="store_name" name="store_name" defaultValue={storeAddress?.name ?? ""} required /></div>
          <div><Label htmlFor="store_phone">Phone</Label><Input id="store_phone" name="store_phone" defaultValue={storeAddress?.phone ?? ""} /></div>
          <div className="sm:col-span-2"><Label htmlFor="store_street1" required>Street Address</Label><Input id="store_street1" name="store_street1" defaultValue={storeAddress?.street1 ?? ""} required /></div>
          <div className="sm:col-span-2"><Label htmlFor="store_street2">Suite / Unit</Label><Input id="store_street2" name="store_street2" defaultValue={storeAddress?.street2 ?? ""} /></div>
          <div><Label htmlFor="store_city" required>City</Label><Input id="store_city" name="store_city" defaultValue={storeAddress?.city ?? ""} required /></div>
          <div><Label htmlFor="store_state" required>State (2-letter)</Label><Input id="store_state" name="store_state" maxLength={2} defaultValue={storeAddress?.state ?? ""} placeholder="CA" required /></div>
          <div><Label htmlFor="store_zip" required>ZIP</Label><Input id="store_zip" name="store_zip" defaultValue={storeAddress?.zip ?? ""} required /></div>
          <div><Label htmlFor="store_country">Country</Label><Input id="store_country" name="store_country" defaultValue={storeAddress?.country ?? "US"} /></div>
        </div>
      </Section>

      <Section title="Handling Fee">
        <div className="max-w-xs">
          <Label htmlFor="handling_fee">Per-order handling fee ($)</Label>
          <Input
            id="handling_fee"
            name="handling_fee"
            type="number"
            step="0.01"
            min="0"
            defaultValue={(defaultValues as any)?.handling_fee ?? ""}
            placeholder="0.00"
          />
          <p className="mt-1.5 text-xs text-gray-400">Added to every shipping rate from EasyPost to cover boxes, tape, and packing materials. Not shown as a separate line item.</p>
        </div>
      </Section>

      <Section title="Shipping Protection">
        <p className="text-sm text-gray-500">Automatically require insurance and/or signature confirmation once an order's subtotal reaches these amounts. Set to 0 to disable.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="insurance_min_subtotal">Insure orders ≥ ($)</Label>
            <Input
              id="insurance_min_subtotal"
              name="insurance_min_subtotal"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaultValues?.insurance_min_subtotal ?? 0}
              placeholder="0.00"
            />
          </div>
          <div>
            <Label htmlFor="signature_min_subtotal">Require signature ≥ ($)</Label>
            <Input
              id="signature_min_subtotal"
              name="signature_min_subtotal"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaultValues?.signature_min_subtotal ?? 0}
              placeholder="0.00"
            />
          </div>
        </div>
      </Section>

      <Section title="Shipping Countries">
        <p className="text-sm text-gray-500">Check the countries you ship to. Customers will only see these options at checkout.</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2 max-h-72 overflow-y-auto border border-gray-200 rounded-md p-3 bg-gray-50">
          {COUNTRIES.map((country) => (
            <label key={country.code} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={shippingCountries.includes(country.code)}
                onChange={(e) =>
                  setShippingCountries((prev) =>
                    e.target.checked
                      ? [...prev, country.code]
                      : prev.filter((c) => c !== country.code)
                  )
                }
                className="h-4 w-4 rounded border-gray-300 accent-gray-900"
              />
              <span className="text-sm text-gray-700">
                <span className="font-mono text-xs text-gray-400 mr-1">{country.code}</span>
                {country.name}
              </span>
            </label>
          ))}
        </div>
        {shippingCountries.length === 0 && (
          <p className="text-sm text-red-500">Select at least one country.</p>
        )}
      </Section>

      <Section title="Tax">
        <div>
          <Label>Tax Mode</Label>
          <div className="flex flex-col gap-2 mt-1">
            {([["none", "No tax"], ["stripe", "Stripe Tax (automatic)"], ["flat_rate", "Flat rate"]] as const).map(([val, label]) => (
              <label key={val} className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="tax_mode_radio" value={val} checked={taxMode === val} onChange={() => setTaxMode(val)} className="h-4 w-4" />
                <span className="text-sm">{label}</span>
              </label>
            ))}
          </div>
        </div>
        {taxMode === "flat_rate" && (
          <div className="max-w-xs">
            <Label htmlFor="tax_flat_rate">Tax Rate (e.g. 0.08 for 8%)</Label>
            <Input id="tax_flat_rate" name="tax_flat_rate" type="number" step="0.001" min="0" max="1" defaultValue={defaultValues?.tax_flat_rate ?? ""} placeholder="0.08" />
          </div>
        )}
      </Section>

        <Button type="submit" size="lg" className="w-full lg:hidden" loading={saving}>Save Settings</Button>
      </div>

    </form>
  );
}
