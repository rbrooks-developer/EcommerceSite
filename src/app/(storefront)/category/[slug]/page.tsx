import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { CategoryProducts } from "@/components/storefront/CategoryProducts";
import { Breadcrumbs } from "@/components/storefront/Breadcrumbs";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { Category, Product } from "@/types";

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
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();

  const [category, allCatsRes] = await Promise.all([
    getCategoryBySlug(slug),
    supabase.from("categories").select("id, slug, name, parent_id"),
  ]);

  if (!category) notFound();
  const allCategories = (allCatsRes.data ?? []) as CategoryRow[];

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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <div className="relative py-8">
        {/* Header — always padded */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Breadcrumbs crumbs={[
            { label: "Home", href: "/" },
            { label: category.name },
          ]} />
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">{category.name}</h1>
            <span className="text-sm" style={{ opacity: 0.5 }}>{products.length} products</span>
          </div>
        </div>

        {/* Products — edge-to-edge on mobile, padded on sm+ */}
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <CategoryProducts products={products} />
        </div>
      </div>
    </>
  );
}
