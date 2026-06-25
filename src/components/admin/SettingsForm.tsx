"use client";

import { useEffect, useRef, useState } from "react";
import { updateSettings } from "@/lib/actions/settings";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "./ImageUpload";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";
import { COUNTRIES } from "@/lib/data/countries";
import type { SiteSettings } from "@/types";
import type { HomepageConfig, NavConfig, FooterConfig, ContactInfo, StoreAddress } from "@/types";

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
  const [logoUrl, setLogoUrl] = useState<string[]>(defaultValues?.logo_url ? [defaultValues.logo_url] : []);
  const [faviconUrl, setFaviconUrl] = useState<string[]>(defaultValues?.favicon_url ? [defaultValues.favicon_url] : []);

  const homepage = defaultValues?.homepage_config as HomepageConfig | null;

  const [bgColor, setBgColor] = useState(homepage?.bg_color ?? "#ffffff");
  const [fontColor, setFontColor] = useState(homepage?.font_color ?? "#111827");
  const [fontFamily, setFontFamily] = useState(homepage?.font_family ?? "default");
  const [fontGradient, setFontGradient] = useState(homepage?.font_gradient_enabled ?? false);
  const [checkoutSectionColor, setCheckoutSectionColor] = useState(homepage?.checkout_section_color ?? "#1a1a1a");
  const [checkoutTextboxColor, setCheckoutTextboxColor] = useState(homepage?.checkout_textbox_color ?? "#2a2a2a");

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const form = e.currentTarget;
    const g = (name: string) => (form.elements.namedItem(name) as HTMLInputElement)?.value ?? "";

    const result = await updateSettings({
      site_title: g("site_title"),
      meta_title: g("meta_title") || undefined,
      meta_description: g("meta_description") || undefined,
      logo_url: logoUrl[0] ?? null,
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
        hero_font: g("hero_font") || "Playfair Display",
        service_images: serviceImages,
        og_image_url: ogImageUrl[0] ?? null,
        checkout_section_color: checkoutSectionColor,
        checkout_textbox_color: checkoutTextboxColor,
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
        <div><Label htmlFor="meta_title">Meta Title <span className="text-gray-400 font-normal">(max 60 chars)</span></Label><Input id="meta_title" name="meta_title" maxLength={60} defaultValue={defaultValues?.meta_title ?? ""} /></div>
        <div><Label htmlFor="meta_description">Meta Description <span className="text-gray-400 font-normal">(max 160 chars)</span></Label><Textarea id="meta_description" name="meta_description" maxLength={160} rows={2} defaultValue={defaultValues?.meta_description ?? ""} /></div>
        <div><Label>Logo</Label><ImageUpload value={logoUrl} onChange={setLogoUrl} max={1} /></div>
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
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 ${fontGradient ? "bg-gray-900" : "bg-gray-200"}`}
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
          <Input id="hero_display_name" name="hero_display_name" defaultValue={homepage?.hero_display_name ?? ""} placeholder="e.g. GODLY COMICS" />
        </div>
        <div>
          <Label htmlFor="hero_tagline">Tagline <span className="text-gray-400 font-normal">(small text below title)</span></Label>
          <Input id="hero_tagline" name="hero_tagline" defaultValue={homepage?.hero_tagline ?? ""} placeholder="e.g. Faith. Purpose. Story." />
        </div>
        <div>
          <Label htmlFor="hero_font">Hero Title Font</Label>
          <select
            id="hero_font"
            name="hero_font"
            defaultValue={homepage?.hero_font ?? "Playfair Display"}
            className="mt-1 flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="Playfair Display">Playfair Display</option>
            <option value="Cinzel">Cinzel</option>
            <option value="Cormorant Garamond">Cormorant Garamond</option>
            <option value="EB Garamond">EB Garamond</option>
            <option value="Libre Baskerville">Libre Baskerville</option>
            <option value="Lora">Lora</option>
            <option value="Merriweather">Merriweather</option>
            <option value="Crimson Text">Crimson Text</option>
            <option value="Raleway">Raleway</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Oswald">Oswald</option>
            <option value="Bebas Neue">Bebas Neue</option>
            <option value="Russo One">Russo One</option>
          </select>
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

      <Section title="Cart / Checkout / Account">
        <p className="text-sm text-gray-500">Colors for the cart, checkout, and account pages.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <ColorPicker id="checkout_section_color" label="Section Color" value={checkoutSectionColor} onChange={setCheckoutSectionColor} />
          <ColorPicker id="checkout_textbox_color" label="Textbox Color" value={checkoutTextboxColor} onChange={setCheckoutTextboxColor} />
        </div>
        <p className="text-xs text-gray-400">Section Color = background of panels/cards. Textbox Color = background of input fields and dropdowns.</p>
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
