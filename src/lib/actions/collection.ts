"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type CollectionFormErrors = {
  first_name?: string;
  last_name?: string;
  email?: string;
  images?: string;
  _form?: string;
};

export async function submitCollectionRequest(formData: FormData): Promise<{
  ok?: boolean;
  errors?: CollectionFormErrors;
}> {
  const firstName  = (formData.get("first_name")  as string ?? "").trim();
  const lastName   = (formData.get("last_name")   as string ?? "").trim();
  const email      = (formData.get("email")        as string ?? "").trim().toLowerCase();
  const phone      = (formData.get("phone")        as string ?? "").trim() || null;
  const message    = (formData.get("message")      as string ?? "").trim() || null;
  const imageUrls  = formData.getAll("image_url")  as string[];

  const errors: CollectionFormErrors = {};
  if (!firstName) errors.first_name = "First name is required";
  if (!lastName)  errors.last_name  = "Last name is required";
  if (!email) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = "Please enter a valid email address";
  }
  if (imageUrls.length > 10) errors.images = "Maximum 10 images allowed";
  if (Object.keys(errors).length > 0) return { errors };

  const supabase = createServiceClient();
  const { error } = await supabase.from("collection_requests").insert({
    first_name: firstName,
    last_name:  lastName,
    email,
    phone,
    message,
    image_urls: imageUrls.slice(0, 10),
  });

  if (error) return { errors: { _form: "Failed to submit. Please try again." } };

  revalidatePath("/admin/collections");
  return { ok: true };
}

export async function markCollectionRead(id: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("collection_requests").update({ is_read: true }).eq("id", id);
  revalidatePath("/admin/collections");
}

export async function markAllCollectionsRead(): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from("collection_requests").update({ is_read: true }).eq("is_read", false);
  revalidatePath("/admin/collections");
}

export async function deleteCollectionRequest(id: string, imageUrls: string[]): Promise<void> {
  const supabase = createServiceClient();

  // Extract bare filenames (UUIDs) from URLs and remove from storage
  const filenames = imageUrls
    .map((url) => url.split("/").pop())
    .filter((f): f is string => !!f);

  if (filenames.length > 0) {
    await supabase.storage.from("collection-images").remove(filenames);
  }

  await supabase.from("collection_requests").delete().eq("id", id);
  revalidatePath("/admin/collections");
}
