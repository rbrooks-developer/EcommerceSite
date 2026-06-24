"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const addressSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  company: z.string().optional(),
  address_line1: z.string().min(1, "Street address is required"),
  address_line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional().default(""),
  zip: z.string().min(1, "Postal code is required"),
  country: z.string().min(2).default("US"),
  phone: z.string().optional(),
  is_default_shipping: z.boolean().default(false),
  is_default_billing: z.boolean().default(false),
});

export async function saveAddress(_prev: unknown, formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: { _form: ["Not authenticated"] } };

  const addressId = formData.get("address_id") as string | null;

  const parsed = addressSchema.safeParse({
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    company: formData.get("company") || undefined,
    address_line1: formData.get("address_line1"),
    address_line2: formData.get("address_line2") || undefined,
    city: formData.get("city"),
    state: formData.get("state") || undefined,
    zip: formData.get("zip"),
    country: formData.get("country") || "US",
    phone: formData.get("phone") || undefined,
    is_default_shipping: formData.get("is_default_shipping") === "on",
    is_default_billing: formData.get("is_default_billing") === "on",
  });

  if (!parsed.success) return { error: parsed.error.flatten().fieldErrors };

  const { is_default_shipping, is_default_billing, ...addressData } = parsed.data;

  // Clear existing defaults before setting new ones
  if (is_default_shipping) {
    await supabase.from("user_addresses").update({ is_default_shipping: false } as any).eq("user_id", user.id);
  }
  if (is_default_billing) {
    await supabase.from("user_addresses").update({ is_default_billing: false } as any).eq("user_id", user.id);
  }

  if (addressId) {
    const { error } = await supabase
      .from("user_addresses")
      .update({ ...addressData, is_default_shipping, is_default_billing } as any)
      .eq("id", addressId)
      .eq("user_id", user.id);
    if (error) return { error: { _form: [error.message] } };
  } else {
    const { error } = await supabase
      .from("user_addresses")
      .insert({ ...addressData, is_default_shipping, is_default_billing, user_id: user.id } as any);
    if (error) return { error: { _form: [error.message] } };
  }

  revalidatePath("/account");
  return { success: true };
}

export async function deleteAddress(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  await supabase.from("user_addresses").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/account");
  return { success: true };
}

export async function setDefaultAddress(id: string, type: "shipping" | "billing") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const field = type === "shipping" ? "is_default_shipping" : "is_default_billing";

  await supabase
    .from("user_addresses")
    .update({ [field]: false } as any)
    .eq("user_id", user.id);

  await supabase
    .from("user_addresses")
    .update({ [field]: true } as any)
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath("/account");
  return { success: true };
}
