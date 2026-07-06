"use server";

import { createClient } from "@/lib/supabase/server";
import { siteSettingsSchema, type SiteSettingsInput } from "@/lib/validations/settings";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { revalidatePath, refresh } from "next/cache";

export async function saveCustomsSettings(
  _prevState: { error?: string; success?: true } | null,
  formData: FormData,
): Promise<{ error?: string; success?: true }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const defaultHsTariffNumber = (formData.get("default_hs_tariff_number") as string | null)?.trim() || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("site_settings")
    .update({ default_hs_tariff_number: defaultHsTariffNumber } as any)
    .eq("id", 1);

  if (error) return { error: error.message };
  revalidatePath("/admin/customs");
  refresh();
  return { success: true };
}

export async function saveAnalyticsSettings(
  _prevState: { error?: string; success?: true } | null,
  formData: FormData,
): Promise<{ error?: string; success?: true }> {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const lookerStudioUrl = (formData.get("looker_studio_url") as string | null)?.trim() || null;

  const supabase = await createClient();
  const { data } = await supabase.from("site_settings").select("tracking_config").eq("id", 1).single();
  const existing = (data as any)?.tracking_config ?? {};

  const { error } = await supabase
    .from("site_settings")
    .update({ tracking_config: { ...existing, looker_studio_url: lookerStudioUrl } } as any)
    .eq("id", 1);

  if (error) return { error: error.message };
  revalidatePath("/admin/analytics");
  refresh();
  return { success: true };
}

export async function updateSettings(data: SiteSettingsInput) {
  const auth = await requireAdmin();
  if (auth.error) return { error: { _form: [auth.error] } };

  const parsed = siteSettingsSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // Preserve keys in tracking_config that the settings form doesn't know about
  // (e.g. looker_studio_url saved separately from the analytics page).
  const { data: current } = await supabase
    .from("site_settings")
    .select("tracking_config")
    .eq("id", 1)
    .single();
  const existingTracking = (current as any)?.tracking_config ?? {};
  const mergedTracking = { ...existingTracking, ...parsed.data.tracking_config };

  const { error } = await supabase
    .from("site_settings")
    .update({ ...parsed.data, tracking_config: mergedTracking } as any)
    .eq("id", 1);

  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/", "layout");
  refresh();
  return { success: true };
}
