import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import type { Product, Category } from "@/types";

export type ProductListRow = Pick<Product, "id" | "slug" | "name" | "price" | "images" | "inventory"> & { category_id: string | null };
export type CategoryRow = Pick<Category, "id" | "slug" | "name"> & { parent_id: string | null };

export const getProducts = unstable_cache(
  async (): Promise<ProductListRow[]> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("products")
      .select("id, slug, name, price, images, inventory, category_id")
      .eq("is_published", true)
      .order("created_at", { ascending: false });
    return (data ?? []) as ProductListRow[];
  },
  ["all-products"],
  { tags: ["products"], revalidate: 3600 }
);

export const getCategories = unstable_cache(
  async (): Promise<CategoryRow[]> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("categories")
      .select("id, slug, name, parent_id")
      .order("name");
    return (data ?? []) as CategoryRow[];
  },
  ["all-categories"],
  { tags: ["categories"], revalidate: 3600 }
);
