import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { getCategories, getProducts } from "@/lib/data/products";
import { CategoryProducts } from "@/components/storefront/CategoryProducts";
import { CategorySidebar } from "@/components/storefront/CategorySidebar";
import type { Metadata } from "next";
import type { HomepageConfig, ProductConfig } from "@/types";

export const metadata: Metadata = { title: "My Favorites" };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch user's favorite IDs, then load only published products from that set
  const { data: favRows } = await supabase
    .from("product_favorites")
    .select("product_id")
    .eq("user_id", user.id);

  const favProductIds = (favRows ?? []).map((r) => (r as { product_id: string }).product_id);

  let products: {
    id: string;
    slug: string;
    name: string;
    price: number;
    images: string[];
    inventory: number;
  }[] = [];

  if (favProductIds.length > 0) {
    const { data: prodRows } = await supabase
      .from("products")
      .select("id, slug, name, price, images, inventory")
      .in("id", favProductIds)
      .eq("is_published", true);
    products = (prodRows ?? []) as typeof products;
  }

  const [allProducts, categories, settings] = await Promise.all([getProducts(), getCategories(), getSettings()]);

  const homepage = settings?.homepage_config as HomepageConfig | null;
  const productCfg = (settings as any)?.product_config as ProductConfig | null;
  const fontColor = homepage?.font_color ?? "#111827";
  const bgColor = homepage?.bg_color ?? "#ffffff";
  const pageSize = productCfg?.products_per_page ?? 24;

  const favoriteIds = new Set(products.map((p) => p.id));
  const categoryIdsWithProducts = new Set(
    allProducts.map((p) => p.category_id).filter(Boolean) as string[]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col gap-8 md:flex-row">
        {categories.length > 0 && (
          <aside className="md:w-52 shrink-0">
            <CategorySidebar
              categories={categories}
              activeSlug={undefined}
              activePage="favorites"
              fontColor={fontColor}
              bgColor={bgColor}
              categoryIdsWithProducts={categoryIdsWithProducts}
              isLoggedIn={true}
            />
          </aside>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-xl font-bold">My Favorites</h1>
            <span className="text-sm" style={{ opacity: 0.5 }}>{products.length} items</span>
          </div>

          {products.length === 0 ? (
            <div className="text-center py-20" style={{ opacity: 0.5 }}>
              <p className="text-base">You haven&apos;t saved any favorites yet.</p>
              <Link href="/products" className="underline mt-2 inline-block text-sm">
                Browse products
              </Link>
            </div>
          ) : (
            <CategoryProducts
              products={products}
              pageSize={pageSize}
              favoriteIds={favoriteIds}
              isLoggedIn={true}
            />
          )}
        </div>
      </div>
    </div>
  );
}
