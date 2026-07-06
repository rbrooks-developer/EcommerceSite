"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath, refresh } from "next/cache";
import { z } from "zod";

const profileSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
});

export async function updateProfile(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: { _form: ["Not authenticated"] } };

  const parsed = profileSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone") || undefined,
  });

  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, updated_at: new Date().toISOString() } as any)
    .eq("id", user.id);

  if (error) return { error: { _form: [error.message] } };

  revalidatePath("/account");
  refresh();
  return { success: true };
}

export async function saveAvatarUrl(avatarUrl: string | null): Promise<{ error?: string; success?: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() } as any)
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/account");
  revalidatePath("/", "layout");
  refresh();
  return { success: true };
}

export async function saveThemePreference(theme: "light" | "dark"): Promise<{ error?: string; success?: true }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("profiles")
    .update({ theme_preference: theme, updated_at: new Date().toISOString() } as any)
    .eq("id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/admin", "layout");
  return { success: true };
}

export async function changePassword(_prev: unknown, formData: FormData) {
  const password = (formData.get("password") as string) ?? "";
  const confirm = (formData.get("confirm_password") as string) ?? "";

  if (password.length < 8) {
    return { error: { password: ["Must be at least 8 characters"] } };
  }
  if (password !== confirm) {
    return { error: { confirm_password: ["Passwords do not match"] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: { _form: [error.message] } };

  return { success: true };
}
