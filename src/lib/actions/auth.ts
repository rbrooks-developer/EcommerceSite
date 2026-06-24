"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendWelcomeEmail } from "@/lib/emails/welcomeEmail";
import { redirect } from "next/navigation";
import { z } from "zod";

const authSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const registerSchema = authSchema.extend({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
});

export async function login(_prevState: unknown, formData: FormData) {
  const parsed = authSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: { _form: [error.message] } };

  const redirectTo = formData.get("redirect") as string | null;
  redirect(redirectTo ?? "/");
}

export async function register(_prevState: unknown, formData: FormData) {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    first_name: formData.get("first_name"),
    last_name: formData.get("last_name"),
    phone: formData.get("phone") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const { email, password, first_name, last_name, phone } = parsed.data;

  const supabase = await createClient();
  const { data: signUpData, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
      // Passed to raw_user_meta_data so the DB trigger can read them on row creation
      data: { first_name, last_name, phone: phone ?? null },
    },
  });

  if (error) return { error: { _form: [error.message] } };

  // Upsert profile data via service client (bypasses RLS, handles both
  // "trigger already created the row" and "row not yet created" cases)
  if (signUpData.user) {
    const serviceClient = await createServiceClient();
    const { error: profileError } = await serviceClient
      .from("profiles")
      .upsert({
        id: signUpData.user.id,
        email,
        first_name,
        last_name,
        phone: phone ?? null,
        updated_at: new Date().toISOString(),
      } as any);
    if (profileError) {
      console.error("[register] profile upsert failed:", profileError.message);
    }
  }

  sendWelcomeEmail(
    email,
    process.env.NEXT_PUBLIC_SITE_TITLE ?? "My Store",
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ).catch((err) => console.error("Failed to send welcome email:", err));

  // When email confirmation is disabled Supabase returns a session immediately —
  // redirect the now-logged-in user instead of showing "check your email"
  if (signUpData.session) {
    redirect("/account");
  }

  return { success: true };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPassword(_prevState: unknown, formData: FormData) {
  const email = (formData.get("email") as string | null)?.trim();
  if (!email || !email.includes("@")) {
    return { error: { email: ["A valid email address is required"] } };
  }

  const supabase = await createClient();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/api/auth/callback?next=/reset-password`,
  });

  if (error) return { error: { _form: [error.message] } };
  return { success: true };
}

export async function updatePassword(_prevState: unknown, formData: FormData) {
  const password = formData.get("password") as string;
  const confirm = formData.get("confirm_password") as string;

  if (!password || password.length < 8) {
    return { error: { password: ["Password must be at least 8 characters"] } };
  }
  if (password !== confirm) {
    return { error: { confirm_password: ["Passwords do not match"] } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: { _form: [error.message] } };

  redirect("/");
}
