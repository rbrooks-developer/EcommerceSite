"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { saveEbayConfig } from "@/lib/ebay/auth";
import { revalidatePath } from "next/cache";

export async function disconnectEbay(_prevState: unknown) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  try {
    await saveEbayConfig({
      access_token:    null,
      refresh_token:   null,
      token_expires_at: null,
      ebay_user_id:    null,
      ebay_username:   null,
    });
    revalidatePath("/admin/ebay");
    return { success: true as const };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function saveEbayCategoryMapping(
  categoryId: string,
  ebayCategoryId: string | null,
  ebayCategoryName: string | null
) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ ebay_category_id: ebayCategoryId, ebay_category_name: ebayCategoryName } as any)
    .eq("id", categoryId);

  if (error) return { error: error.message };
  revalidatePath("/admin/categories");
  return { success: true as const };
}

export async function saveEbayInventorySyncSettings(
  enabled: boolean,
  intervalMinutes: number,
): Promise<{ error?: string; success?: true }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };
  try {
    await saveEbayConfig({
      inventory_sync_enabled:          enabled,
      inventory_sync_interval_minutes: Math.max(5, Math.round(intervalMinutes)),
    });
    revalidatePath("/admin/ebay");
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
