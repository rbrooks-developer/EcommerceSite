import { getSettings } from "@/lib/data/settings";
import { getProducts, getCategories } from "@/lib/data/products";
import { getHotCartCounts } from "@/lib/data/cart";
import { createClient } from "@/lib/supabase/server";
import { CategoryProducts } from "@/components/storefront/CategoryProducts";
import { CategorySidebar } from "@/components/storefront/CategorySidebar";
import { Breadcrumbs } from "@/components/storefront/Breadcrumbs";
import type { Metadata } from "next";
import type { HomepageConfig, ProductConfig, SidebarStyle } from "@/types";
import type { ProductListRow, CategoryRow } from "@/lib/data/products";

function collectIds(rootId: string, all: CategoryRow[]): string[] {
  const children = all.filter((c) => c.parent_id === rootId);
  return [rootId, ...children.flatMap((c) => collectIds(c.id, all))];
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const siteTitle = settings?.site_title ?? "Store";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const title = `All Products | ${siteTitle}`;
  const description = settings?.meta_description ?? `Shop all products at ${siteTitle}.`;
  return {
    title,
    description,
    alternates: { canonical: `${appUrl}/products` },
    openGraph: {
      type: "website",
      url: `${appUrl}/products`,
      title,
      description,
    },
  };
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const supabase = await createClient();
  const [products, categories, settings, { data: { user } }] = await Promise.all([
    getProducts(),
    getCategories(),
    getSettings(),
    supabase.auth.getUser(),
  ]);

  const homepage = settings?.homepage_config as HomepageConfig | null;
  const productCfg = (settings as any)?.product_config as ProductConfig | null;
  const fontColor = homepage?.font_color ?? "#111827";
  const bgColor = homepage?.bg_color ?? "#ffffff";
  const pageSize = productCfg?.products_per_page ?? 24;
  const sidebarStyle = (productCfg?.category_sidebar_style ?? "standard") as SidebarStyle;
  const sidebarItemOpacity = productCfg?.sidebar_item_opacity ?? 0.75;
  const sidebarFontSize = productCfg?.sidebar_font_size ?? "sm";
  const sidebarGlow = productCfg?.sidebar_glow ?? "none";
  const hotCartThreshold = productCfg?.hot_cart_threshold ?? 1;

  const categoryIdsWithProducts = new Set(
    products.map((p) => p.category_id).filter(Boolean) as string[]
  );

  const categoryCountMap: Record<string, number> = {};
  if (sidebarStyle === "count-badges") {
    for (const cat of categories) {
      const ids = collectIds(cat.id, categories);
      categoryCountMap[cat.id] = products.filter((p) => p.category_id && ids.includes(p.category_id)).length;
    }
  }

  const selectedCat = category ? categories.find((c) => c.slug === category) : null;
  const filterIds = selectedCat ? collectIds(selectedCat.id, categories) : null;
  const filtered: ProductListRow[] = filterIds
    ? products.filter((p) => p.category_id && filterIds.includes(p.category_id))
    : products;

  const heading = selectedCat?.name ?? "All Products";

  let favoriteIds = new Set<string>();
  if (user) {
    const { data: favRows } = await supabase
      .from("product_favorites")
      .select("product_id")
      .eq("user_id", user.id);
    if (favRows) {
      favoriteIds = new Set((favRows as { product_id: string }[]).map((r) => r.product_id));
    }
  }

  const hotCartCounts = await getHotCartCounts(products.map((p) => p.id), user?.id ?? null);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Breadcrumbs crumbs={[{ label: "Home", href: "/" }, { label: "All Products" }]} />
      <div className="flex flex-col gap-8 md:flex-row mt-4">
        {categories.length > 0 && (
          <aside className="md:w-52 shrink-0 md:sticky md:top-20 md:self-start md:max-h-[calc(100vh-5rem)] md:overflow-y-auto" style={{ zIndex: 46 }}>
            <CategorySidebar
              categories={categories}
              activeSlug={undefined}
              fontColor={fontColor}
              bgColor={bgColor}
              categoryIdsWithProducts={categoryIdsWithProducts}
              isLoggedIn={!!user}
              sidebarStyle={sidebarStyle}
              categoryCountMap={categoryCountMap}
              totalProductCount={sidebarStyle === "count-badges" ? products.length : undefined}
              sidebarItemOpacity={sidebarItemOpacity}
              sidebarFontSize={sidebarFontSize}
              sidebarGlow={sidebarGlow}
            />
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl font-bold">{heading}</h1>
            <span className="text-sm" style={{ opacity: 0.5 }}>{filtered.length} products</span>
          </div>

          <CategoryProducts
            key={category ?? "all"}
            products={filtered}
            pageSize={pageSize}
            favoriteIds={favoriteIds}
            isLoggedIn={!!user}
            hotCartCounts={hotCartCounts}
            hotCartThreshold={hotCartThreshold}
          />
        </div>
      </div>
    </div>
  );
}
