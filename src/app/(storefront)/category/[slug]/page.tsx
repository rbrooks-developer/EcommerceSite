import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { CategoryProducts } from "@/components/storefront/CategoryProducts";
import { CategorySidebar } from "@/components/storefront/CategorySidebar";
import { Breadcrumbs } from "@/components/storefront/Breadcrumbs";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Category, Product, HomepageConfig } from "@/types";

type CategoryRow = Pick<Category, "id" | "slug" | "name"> & { parent_id: string | null };

function collectIds(rootId: string, all: CategoryRow[]): string[] {
  const children = all.filter((c) => c.parent_id === rootId);
  return [rootId, ...children.flatMap((c) => collectIds(c.id, all))];
}

// Cached so generateMetadata and the page component share one DB round-trip
const getCategoryBySlug = cache(async (slug: string): Promise<CategoryRow | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, slug, name, parent_id")
    .eq("slug", slug)
    .maybeSingle();
  return data as CategoryRow | null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [category, settings] = await Promise.all([getCategoryBySlug(slug), getSettings()]);
  if (!category) return {};
  const siteTitle = settings?.site_title ?? "Store";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return {
    title: `${category.name} | ${siteTitle}`,
    description: `Browse ${category.name} products at ${siteTitle}.`,
    alternates: { canonical: `${appUrl}/category/${slug}` },
    openGraph: {
      type: "website",
      url: `${appUrl}/category/${slug}`,
      title: `${category.name} | ${siteTitle}`,
      description: `Browse ${category.name} products at ${siteTitle}.`,
    },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const [category, allCatsRes, settings, allProductCatsRes] = await Promise.all([
    getCategoryBySlug(slug),
    supabase.from("categories").select("id, slug, name, parent_id").order("name"),
    getSettings(),
    supabase.from("products").select("category_id").eq("is_published", true),
  ]);

  if (!category) notFound();
  const allCategories = (allCatsRes.data ?? []) as CategoryRow[];

  const homepage = settings?.homepage_config as HomepageConfig | null;
  const fontColor = homepage?.font_color ?? "#111827";
  const bgColor = homepage?.bg_color ?? "#ffffff";

  const categoryIdsWithProducts = new Set(
    ((allProductCatsRes.data ?? []) as { category_id: string | null }[])
      .map((p) => p.category_id)
      .filter(Boolean) as string[]
  );

  // Include products from all descendant categories
  const ids = collectIds(category.id, allCategories);
  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, slug, name, price, images, inventory")
    .in("category_id", ids)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  const products = (rawProducts ?? []) as Pick<Product, "id" | "slug" | "name" | "price" | "images" | "inventory">[];

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: appUrl || "/" },
      { "@type": "ListItem", position: 2, name: category.name, item: `${appUrl}/category/${category.slug}` },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumbs crumbs={[
          { label: "Home", href: "/" },
          { label: category.name },
        ]} />

        <div className="flex flex-col gap-8 md:flex-row mt-4">
          {allCategories.length > 0 && (
            <aside className="md:w-52 shrink-0">
              <CategorySidebar
                categories={allCategories}
                activeSlug={slug}
                fontColor={fontColor}
                bgColor={bgColor}
                categoryIdsWithProducts={categoryIdsWithProducts}
              />
            </aside>
          )}

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-5">
              <h1 className="text-xl font-bold">{category.name}</h1>
              <span className="text-sm" style={{ opacity: 0.5 }}>{products.length} products</span>
            </div>
            <CategoryProducts products={products} />
          </div>
        </div>
      </div>
    </>
  );
}
