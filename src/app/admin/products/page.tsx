import { Suspense } from "react";
import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { Plus } from "lucide-react";
import { DeleteAllProductsButton, ProductCard, ProductTableRow } from "./ProductActions";
import { ProductFilters } from "./ProductFilters";
import { SendPromoButton } from "./SendPromoModal";
import { getEmailTemplates } from "@/lib/actions/email-templates";
import { getSettings } from "@/lib/data/settings";
import type { Product, ProductConfig } from "@/types";

type ProductRow = Product & { categories: { name: string } | null };
type CategoryRow = { id: string; name: string; parent_id: string | null };

function getDescendantIds(rootId: string, allCats: CategoryRow[]): Set<string> {
  const ids = new Set<string>([rootId]);
  for (const cat of allCats) {
    if (cat.parent_id && ids.has(cat.parent_id)) ids.add(cat.id);
  }
  // Second pass in case of deeper nesting
  for (const cat of allCats) {
    if (cat.parent_id && ids.has(cat.parent_id)) ids.add(cat.id);
  }
  return ids;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; category?: string }>;
}) {
  const { search, category } = await searchParams;
  const supabase = await createClient();
  const sb = createServiceClient();

  const [{ data: raw }, { data: cats }, { data: favRows }, { data: adminProfiles }, { data: promoRows }, templates, settings] = await Promise.all([
    supabase.from("products").select("*, categories(name)"),
    supabase.from("categories").select("id, name, parent_id").order("name"),
    sb.from("product_favorites").select("product_id, user_id"),
    sb.from("profiles").select("id").eq("role", "admin"),
    sb.from("promos").select("id, code, discount_value, discount_type").eq("enabled", true).order("code"),
    getEmailTemplates(),
    getSettings(),
  ]);

  const productCfg = (settings as any)?.product_config as ProductConfig | null;
  const promoEmailEnabled = productCfg?.promo_email_enabled ?? true;
  const promos = (promoRows ?? []) as { id: string; code: string; discount_value: number; discount_type: string }[];

  let products = (raw ?? []) as ProductRow[];
  const categories = cats ?? [];

  const adminIds = new Set((adminProfiles ?? []).map((p: { id: string }) => p.id));

  // Build favorite counts by product, excluding admins
  const favCounts: Record<string, number> = {};
  for (const r of (favRows ?? []) as { product_id: string; user_id: string }[]) {
    if (adminIds.has(r.user_id)) continue;
    favCounts[r.product_id] = (favCounts[r.product_id] ?? 0) + 1;
  }

  // Filter
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    products = products.filter((p) => p.name.toLowerCase().includes(q));
  }
  if (category) {
    // Include the selected category AND all its descendants so that
    // filtering by a parent (e.g. "Comic Books") shows products in
    // child categories (Marvel Comics, DC Comics, etc.) too.
    const descendantIds = getDescendantIds(category, categories);
    products = products.filter((p) => p.category_id && descendantIds.has(p.category_id));
  }

  // Sort: category name A-Z, then product name A-Z
  products.sort((a, b) => {
    const catCmp = (a.categories?.name ?? "").localeCompare(b.categories?.name ?? "");
    return catCmp !== 0 ? catCmp : a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <div className="flex items-center gap-2">
          <DeleteAllProductsButton />
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 h-11 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Product
          </Link>
        </div>
      </div>

      <Suspense>
        <ProductFilters categories={categories} />
      </Suspense>

      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            favoriteCount={favCounts[product.id] ?? 0}
            promoEmailEnabled={promoEmailEnabled}
            templates={templates}
            promos={promos}
          />
        ))}
        {products.length === 0 && (
          <p className="py-12 text-center text-sm text-gray-400">No products found.</p>
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Category</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Price</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Inventory</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 whitespace-nowrap">♥ Favs</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <ProductTableRow
                  key={product.id}
                  product={product}
                  favoriteCount={favCounts[product.id] ?? 0}
                  promoEmailEnabled={promoEmailEnabled}
                  templates={templates}
                  promos={promos}
                />
              ))}
            </tbody>
          </table>
          {products.length === 0 && (
            <p className="py-12 text-center text-sm text-gray-400">No products found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
