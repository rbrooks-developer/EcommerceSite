"use server";

import { requireAdmin } from "@/lib/auth/requireAdmin";
import { saveEbayConfig, getEbayConfig, refreshAccessToken } from "@/lib/ebay/auth";
import { revalidatePath, refresh } from "next/cache";

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
    refresh();
    return { success: true as const };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

export async function manualRefreshEbayToken(_prevState: unknown) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  try {
    const config = await getEbayConfig();
    if (!config?.refresh_token) return { error: "No refresh token stored — reconnect eBay." };

    await refreshAccessToken(config);
    revalidatePath("/admin/ebay");
    refresh();
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
  refresh();
  return { success: true as const };
}

export async function saveEbayListingSettings(
  _prevState: { error?: string; success?: true } | null,
  formData: FormData,
): Promise<{ error?: string; success?: true }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const cgcCensusUrl      = (formData.get("cgc_census_url")        as string | null)?.trim() || null;
  const cgcButtonImageUrl = (formData.get("cgc_button_image_url")  as string | null)?.trim() || null;

  try {
    await saveEbayConfig({ cgc_census_url: cgcCensusUrl, cgc_button_image_url: cgcButtonImageUrl });
    revalidatePath("/admin/ebay");
    refresh();
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function saveEbayInventorySyncSettings(
  _prevState: { error?: string; success?: true } | null,
  formData: FormData,
): Promise<{ error?: string; success?: true }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const enabled   = formData.has("enabled");
  const hours     = Math.max(1, Math.min(24, Number(formData.get("interval_hours")) || 1));
  const discount  = Math.max(0, Math.min(99, Number(formData.get("price_discount_percent")) || 0));

  try {
    await saveEbayConfig({
      inventory_sync_enabled:          enabled,
      inventory_sync_interval_minutes: hours * 60,
      price_discount_percent:          discount,
    });
    revalidatePath("/admin/ebay");
    refresh();
    return { success: true };
  } catch (err: any) {
    return { error: err.message };
  }
}
