"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function toggleFavorite(productId: string): Promise<{ isFavorited: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("product_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("product_favorites")
      .delete()
      .eq("id", (existing as { id: string }).id);
    revalidatePath("/favorites");
    return { isFavorited: false };
  } else {
    await supabase
      .from("product_favorites")
      .insert({ user_id: user.id, product_id: productId });
    revalidatePath("/favorites");
    return { isFavorited: true };
  }
}
