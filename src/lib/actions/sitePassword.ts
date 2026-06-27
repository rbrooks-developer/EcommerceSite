"use server";

import { cookies } from "next/headers";
import { createHash } from "crypto";
import { getSettings } from "@/lib/data/settings";
import { redirect } from "next/navigation";

export async function verifySitePassword(prevState: { error: string } | null, formData: FormData) {
  const input = (formData.get("password") as string) ?? "";
  const settings = await getSettings();
  const sitePassword = (settings as any)?.site_password as string | null;

  if (!sitePassword) {
    redirect("/");
  }

  if (input !== sitePassword) {
    return { error: "Incorrect password. Please try again." };
  }

  const cookieValue = createHash("sha256").update(sitePassword).digest("hex");
  const cookieStore = await cookies();
  cookieStore.set("__site_pass", cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  redirect("/");
}
