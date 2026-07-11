"use server";

import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validations/category";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { revalidatePath, revalidateTag, refresh } from "next/cache";
import { redirect } from "next/navigation";

export async function createCategory(_prevState: unknown, formData: FormData) {
  const auth = await requireAdmin();
  if (auth.error) return { error: { _form: [auth.error] } };

  const supabase = await createClient();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    parent_id: formData.get("parent_id") || null,
    ebay_category_id:   formData.get("ebay_category_id")   || null,
    ebay_category_name: formData.get("ebay_category_name") || null,
    hs_tariff_number:   formData.get("hs_tariff_number")   || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase.from("categories").insert(parsed.data as any);
  if (error) return { error: { _form: [error.message] } };

  revalidateTag("categories", "default");
  revalidatePath("/admin/categories");
  revalidatePath("/");
  redirect("/admin/categories");
}

export async function updateCategory(id: string, _prevState: unknown, formData: FormData) {
  const auth = await requireAdmin();
  if (auth.error) return { error: { _form: [auth.error] } };

  const supabase = await createClient();

  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    parent_id: formData.get("parent_id") || null,
    ebay_category_id:   formData.get("ebay_category_id")   || null,
    ebay_category_name: formData.get("ebay_category_name") || null,
    hs_tariff_number:   formData.get("hs_tariff_number")   || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { error } = await supabase
    .from("categories")
    .update(parsed.data as any)
    .eq("id", id);

  if (error) return { error: { _form: [error.message] } };

  revalidateTag("categories", "default");
  revalidatePath("/admin/categories");
  revalidatePath("/");
  redirect("/admin/categories");
}

export async function deleteCategory(id: string) {
  const auth = await requireAdmin();
  if (auth.error) throw new Error(auth.error);

  const supabase = await createClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateTag("categories", "default");
  revalidatePath("/admin/categories");
  revalidatePath("/");
  refresh();
}
