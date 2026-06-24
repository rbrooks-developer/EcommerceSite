import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { ProductCard } from "@/components/storefront/ProductCard";
import type { HomepageConfig, Product, Category } from "@/types";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    title: settings?.meta_title ?? settings?.site_title ?? "Home",
    description: settings?.meta_description ?? undefined,
    openGraph: {
      title: settings?.meta_title ?? settings?.site_title ?? "Home",
      description: settings?.meta_description ?? undefined,
      images: settings?.logo_url ? [settings.logo_url] : [],
    },
  };
}

export default async function HomePage() {
  const [settings, supabase] = await Promise.all([getSettings(), createClient()]);
  const homepage = settings?.homepage_config as HomepageConfig | null;

  const featuredProductIds = homepage?.featured_product_ids ?? [];
  const featuredCategoryIds = homepage?.featured_category_ids ?? [];

  const [productsRes, categoriesRes] = await Promise.all([
    featuredProductIds.length
      ? supabase.from("products").select("id, slug, name, price, images").in("id", featuredProductIds).eq("is_published", true)
      : Promise.resolve({ data: [] as Pick<Product, "id" | "slug" | "name" | "price" | "images">[] }),
    featuredCategoryIds.length
      ? supabase.from("categories").select("id, slug, name").in("id", featuredCategoryIds)
      : Promise.resolve({ data: [] as Pick<Category, "id" | "slug" | "name">[] }),
  ]);
  const featuredProducts = productsRes.data as Pick<Product, "id" | "slug" | "name" | "price" | "images">[];
  const featuredCategories = categoriesRes.data as Pick<Category, "id" | "slug" | "name">[];

  const bgColor = (settings as any)?.bg_color ?? "#ffffff";
  const fontColor = (settings as any)?.font_color ?? "#111827";

  return (
    <div>
      {/* Hero */}
      <section className="relative" style={{ backgroundColor: bgColor, color: fontColor }}>
        {homepage?.hero_image_url && (
          <Image
            src={homepage.hero_image_url}
            alt="Hero"
            fill
            className="object-cover opacity-40"
            priority
            sizes="100vw"
          />
        )}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 md:py-36 text-center">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight">
            {homepage?.hero_heading ?? "Welcome to Our Store"}
          </h1>
          {homepage?.hero_subtext && (
            <p className="mt-4 text-lg opacity-70 max-w-xl mx-auto">
              {homepage.hero_subtext}
            </p>
          )}
          <Link
            href={homepage?.hero_cta_link ?? "/products"}
            className="mt-8 inline-block rounded-md px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: fontColor, color: bgColor }}
          >
            {homepage?.hero_cta_text ?? "Shop Now"}
          </Link>
        </div>
      </section>

      {/* Featured Categories */}
      {featuredCategories.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <h2 className="text-xl font-bold mb-6" style={{ color: fontColor }}>Shop by Category</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {featuredCategories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="rounded-lg border border-black/10 p-4 text-center transition-opacity hover:opacity-70"
                style={{ color: fontColor }}
              >
                <span className="text-sm font-medium">{cat.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold" style={{ color: fontColor }}>Featured Products</h2>
            <Link href="/products" className="text-sm opacity-60 hover:opacity-100 underline underline-offset-2 transition-opacity" style={{ color: fontColor }}>
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

      {/* Fallback CTA if no featured content configured */}
      {featuredProducts.length === 0 && featuredCategories.length === 0 && (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h2 className="text-2xl font-bold" style={{ color: fontColor }}>Browse our products</h2>
          <Link
            href="/products"
            className="mt-6 inline-block rounded-md px-8 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
            style={{ backgroundColor: fontColor, color: bgColor }}
          >
            Shop Now
          </Link>
        </section>
      )}
    </div>
  );
}
