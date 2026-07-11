import Link from "next/link";
import Image from "next/image";
import { getSettings } from "@/lib/data/settings";
import { getProducts, getCategories } from "@/lib/data/products";
import { ogImageUrl } from "@/lib/utils";
import { ProductCard } from "@/components/storefront/ProductCard";
import { ImageCarousel } from "@/components/storefront/ImageCarousel";
import type { HomepageConfig, FooterConfig, CarouselConfig } from "@/types";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const homepage = settings?.homepage_config as import("@/types").HomepageConfig | null;
  const ogImage = homepage?.og_image_url ?? settings?.logo_url ?? null;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const title = settings?.meta_title ?? settings?.site_title ?? "Home";
  const description = settings?.meta_description ?? undefined;
  return {
    title,
    description,
    alternates: { canonical: appUrl || "/" },
    openGraph: {
      type: "website",
      url: appUrl || "/",
      title,
      description,
      images: ogImage ? [ogImageUrl(ogImage)] : [],
    },
  };
}

export default async function HomePage() {
  const [settings, allProducts, allCategories] = await Promise.all([getSettings(), getProducts(), getCategories()]);
  const homepage = settings?.homepage_config as HomepageConfig | null;
  const footer   = settings?.footer_config  as FooterConfig  | null;

  const bgColor   = homepage?.bg_color    ?? "#1a1a1a";
  const fontColor = homepage?.font_color  ?? "#d4af37";
  const heroFont  = homepage?.hero_font   ?? "Playfair Display";
  const logoUrl   = settings?.logo_url    ?? null;
  const logoSpin  = !!(settings as any)?.logo_spin_hero;
  const siteTitle = settings?.site_title  ?? "My Store";

  // Hero display name and tagline: use hero-specific fields, fall back to footer, then site title
  const displayName = homepage?.hero_display_name || footer?.display_name || siteTitle;
  const tagline     = homepage?.hero_tagline     || footer?.tagline       || "";

  // Gold gradient for the hero title: lighter → base → darker using the admin font color
  const goldGradient = `linear-gradient(180deg, color-mix(in srgb, ${fontColor} 60%, white) 0%, ${fontColor} 50%, color-mix(in srgb, ${fontColor} 70%, black) 100%)`;

  const serviceImages       = homepage?.service_images         ?? [];
  const featuredProductIds  = homepage?.featured_product_ids  ?? [];
  const featuredCategoryIds = homepage?.featured_category_ids ?? [];
  const carousel            = homepage?.carousel              ?? null;

  // Filter from cached lists — preserves admin-configured display order
  const featuredProducts = featuredProductIds.length
    ? featuredProductIds.map((id) => allProducts.find((p) => p.id === id)).filter((p) => p !== undefined)
    : [];
  const featuredCategories = featuredCategoryIds.length
    ? featuredCategoryIds.map((id) => allCategories.find((c) => c.id === id)).filter((c) => c !== undefined)
    : [];

  return (
    <div>
      {/* ── Hero ── */}
      <section
        aria-labelledby="hero-heading"
        className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "100svh", backgroundColor: bgColor }}
      >
        {/* Radial gold glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, ${fontColor} 7%, transparent) 0%, transparent 70%)`,
          }}
          aria-hidden="true"
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-4 text-center">
          {/* Logo */}
          {logoUrl && (
            <div
              className="relative w-28 h-28 md:w-36 md:h-36"
              style={{ filter: `drop-shadow(0 0 24px color-mix(in srgb, ${fontColor} 35%, transparent))` }}
            >
              <Image
                src={logoUrl}
                alt={siteTitle}
                fill
                sizes="(min-width: 768px) 144px, 112px"
                className="object-contain"
                style={logoSpin ? { animation: "logo-spin-3d 3s linear infinite" } : undefined}
              />
            </div>
          )}

          {/* Title */}
          <h1
            id="hero-heading"
            className="tracking-[0.2em] text-5xl md:text-7xl lg:text-8xl leading-none uppercase"
            style={{
              fontFamily: `'${heroFont}', serif`,
              background: goldGradient,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {displayName}
          </h1>

          {/* Divider */}
          <div
            className="w-24 h-px"
            style={{ backgroundColor: fontColor, opacity: 0.6 }}
            aria-hidden="true"
          />

          {/* Tagline */}
          {tagline && (
            <p
              className="text-sm md:text-base tracking-[0.25em] uppercase"
              style={{ color: "#9ca3af", WebkitTextFillColor: "#9ca3af" }}
            >
              {tagline}
            </p>
          )}

          {/* CTA button */}
          <div className="mt-4">
            <Link href="/products" className="btn-hero">
              Shop Our Products
            </Link>
          </div>
        </div>

        {/* Bottom fade to background */}
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-24"
          style={{ background: `linear-gradient(to bottom, transparent, ${bgColor})` }}
          aria-hidden="true"
        />
      </section>

      {/* Carousel — only rendered when images are configured */}
      {carousel && carousel.images.length > 0 && (
        <ImageCarousel config={carousel as CarouselConfig} bgColor={bgColor} />
      )}

      {/* Featured Categories */}
      {featuredCategories.length > 0 && (
        <section aria-labelledby="categories-heading" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <h2 id="categories-heading" className="text-xl font-bold mb-6">Shop by Category</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {featuredCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="rounded-lg p-4 text-center transition-opacity hover:opacity-70"
                style={{ border: `1px solid ${fontColor}`, opacity: 0.85 }}
              >
                <span className="text-sm font-medium">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section aria-labelledby="products-heading" className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 id="products-heading" className="text-xl font-bold">Featured Products</h2>
            <Link href="/products" className="text-sm opacity-60 hover:opacity-100 underline underline-offset-2 transition-opacity">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Services section */}
      {serviceImages.length > 0 && (
        <section id="services" aria-labelledby="services-heading" className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16" style={{ zIndex: 46 }}>
          <div className="flex flex-col items-center gap-3 mb-6">
            <h2
              id="services-heading"
              className="tracking-[0.2em] uppercase"
              style={{
                fontFamily: `'${heroFont}', serif`,
                fontSize: "36px",
                background: goldGradient,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Services
            </h2>
            <div className="w-16 h-px" style={{ backgroundColor: fontColor, opacity: 0.6 }} />
          </div>
          {serviceImages.length === 1 ? (
            // Single image: natural size, centered
            <div className="flex justify-center">
              <Image
                src={serviceImages[0]}
                alt={`${displayName} services`}
                width={1200}
                height={800}
                sizes="(min-width: 1280px) 1200px, 100vw"
                style={{ maxWidth: "100%", height: "auto" }}
              />
            </div>
          ) : (
            // 2–3 images: equal-width columns, proportionally scaled to fit
            <div
              className="grid gap-6"
              style={{ gridTemplateColumns: `repeat(${serviceImages.length}, 1fr)` }}
            >
              {serviceImages.map((url, i) => (
                <Image
                  key={i}
                  src={url}
                  alt={`${displayName} — service photo ${i + 1}`}
                  width={1200}
                  height={800}
                  sizes={`(min-width: 1280px) ${Math.floor(1200 / serviceImages.length)}px, (min-width: 640px) 50vw, 100vw`}
                  style={{ width: "100%", height: "auto" }}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
