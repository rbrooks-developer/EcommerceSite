import { getSettings } from "@/lib/data/settings";
import { getProducts, getCategories } from "@/lib/data/products";
import type { CategoryRow } from "@/lib/data/products";
import { CategoryProducts } from "@/components/storefront/CategoryProducts";
import { CategorySidebar } from "@/components/storefront/CategorySidebar";
import { Breadcrumbs } from "@/components/storefront/Breadcrumbs";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { HomepageConfig } from "@/types";

function collectIds(rootId: string, all: CategoryRow[]): string[] {
  const children = all.filter((c) => c.parent_id === rootId);
  return [rootId, ...children.flatMap((c) => collectIds(c.id, all))];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [categories, settings] = await Promise.all([getCategories(), getSettings()]);
  const category = categories.find((c) => c.slug === slug);
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

  const [products, categories, settings] = await Promise.all([
    getProducts(),
    getCategories(),
    getSettings(),
  ]);

  const category = categories.find((c) => c.slug === slug);
  if (!category) notFound();

  const homepage = settings?.homepage_config as HomepageConfig | null;
  const fontColor = homepage?.font_color ?? "#111827";
  const bgColor = homepage?.bg_color ?? "#ffffff";

  const categoryIdsWithProducts = new Set(
    products.map((p) => p.category_id).filter(Boolean) as string[]
  );

  const ids = collectIds(category.id, categories);
  const filtered = products.filter((p) => p.category_id && ids.includes(p.category_id));

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
          {categories.length > 0 && (
            <aside className="md:w-52 shrink-0">
              <CategorySidebar
                categories={categories}
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
              <span className="text-sm" style={{ opacity: 0.5 }}>{filtered.length} products</span>
            </div>
            <CategoryProducts products={filtered} />
          </div>
        </div>
      </div>
    </>
  );
}
