"use server";

import { createClient } from "@/lib/supabase/server";
import { productSchema } from "@/lib/validations/product";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function parseProductFormData(formData: FormData) {
  const imagesRaw = formData.get("images") as string;
  return {
    name: formData.get("name") as string,
    slug: formData.get("slug") as string,
    description: (formData.get("description") as string) || undefined,
    price: parseFloat(formData.get("price") as string),
    cost: formData.get("cost") ? parseFloat(formData.get("cost") as string) : null,
    inventory: parseInt(formData.get("inventory") as string, 10),
    category_id: (formData.get("category_id") as string) || null,
    weight_oz: (parseFloat(formData.get("weight_lbs") as string) || 0) * 16
             + (parseFloat(formData.get("weight_oz") as string) || 0),
    length_in: parseFloat(formData.get("length_in") as string) || undefined,
    width_in: parseFloat(formData.get("width_in") as string) || undefined,
    height_in: parseFloat(formData.get("height_in") as string) || undefined,
    is_published: formData.get("is_published") === "true",
    seo_title: (formData.get("seo_title") as string) || undefined,
    seo_description: (formData.get("seo_description") as string) || undefined,
    images: imagesRaw ? JSON.parse(imagesRaw) : [],
  };
}

export async function createProduct(_prevState: unknown, formData: FormData) {
  const auth = await requireAdmin();
  if (auth.error) return { error: { _form: [auth.error] } };

  const supabase = await createClient();

  const parsed = productSchema.safeParse(parseProductFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase.from("products").insert(parsed.data);
  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/admin/products");
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function updateProduct(id: string, _prevState: unknown, formData: FormData) {
  const auth = await requireAdmin();
  if (auth.error) return { error: { _form: [auth.error] } };

  const supabase = await createClient();

  const parsed = productSchema.safeParse(parseProductFormData(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase
    .from("products")
    .update(parsed.data)
    .eq("id", id);

  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/admin/products");
  revalidatePath(`/products/${parsed.data.slug}`);
  revalidatePath("/products");
  redirect("/admin/products");
}

export async function deleteProduct(id: string) {
  const auth = await requireAdmin();
  if (auth.error) throw new Error(auth.error);

  const supabase = await createClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    // order_items.product_id has no ON DELETE clause, so products that
    // appear in a past order can't be deleted without losing that order's
    // line-item history.
    if (error.code === "23503") {
      throw new Error("This product can't be deleted because it's referenced by an existing order.");
    }
    throw new Error(error.message);
  }
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function deleteAllProducts(): Promise<{ deleted: number; skipped: number }> {
  const auth = await requireAdmin();
  if (auth.error) throw new Error(auth.error);

  const supabase = await createClient();

  // Products referenced by order_items can't be deleted (FK constraint) —
  // exclude them up front so the bulk delete doesn't fail outright and
  // skip every product just because one has order history.
  const { data: orderedRows, error: orderedErr } = await supabase
    .from("order_items")
    .select("product_id");
  if (orderedErr) throw new Error(orderedErr.message);

  const orderedIds = Array.from(new Set((orderedRows ?? []).map((r) => r.product_id)));

  let query = supabase.from("products").delete({ count: "exact" });
  query = orderedIds.length > 0
    ? query.not("id", "in", `(${orderedIds.join(",")})`)
    : query.neq("id", "00000000-0000-0000-0000-000000000000");

  const { error, count } = await query;
  if (error) throw new Error(error.message);

  revalidatePath("/admin/products");
  revalidatePath("/products");

  return { deleted: count ?? 0, skipped: orderedIds.length };
}

export async function togglePublished(id: string, current: boolean) {
  const auth = await requireAdmin();
  if (auth.error) throw new Error(auth.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("products")
    .update({ is_published: !current })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
  revalidatePath("/products");
}
