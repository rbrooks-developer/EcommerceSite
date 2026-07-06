"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { revalidatePath, refresh } from "next/cache";
import { z } from "zod";

const schema = z.object({
  hs_tariff_number: z.string().min(1, "Tariff number is required").max(20),
  description: z.string().min(1, "Description is required").max(255),
});

export async function createTariffCode(_prevState: unknown, formData: FormData) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const parsed = schema.safeParse({
    hs_tariff_number: formData.get("hs_tariff_number"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("tariff_codes").insert(parsed.data as any);
  if (error) return { error: error.message };

  revalidatePath("/admin/customs");
  refresh();
  return { success: true };
}

export async function updateTariffCode(id: string, _prevState: unknown, formData: FormData) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };

  const parsed = schema.safeParse({
    hs_tariff_number: formData.get("hs_tariff_number"),
    description: formData.get("description"),
  });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const supabase = await createClient();
  const { error } = await supabase.from("tariff_codes").update(parsed.data as any).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/customs");
  refresh();
  return { success: true };
}

export async function deleteTariffCode(id: string) {
  const auth = await requireAdmin();
  if (auth.error) throw new Error(auth.error);

  const supabase = await createClient();
  const { error } = await supabase.from("tariff_codes").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/customs");
  refresh();
}
