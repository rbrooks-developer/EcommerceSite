import { cookies } from "next/headers";
import { createHash } from "crypto";
import { redirect } from "next/navigation";
import type { SiteSettings } from "@/types";

export async function checkSitePassword(settings: SiteSettings | null) {
  const sitePassword = (settings as any)?.site_password as string | null;
  if (!sitePassword) return;

  const cookieStore = await cookies();
  const cookieVal = cookieStore.get("__site_pass")?.value;
  const expected = createHash("sha256").update(sitePassword).digest("hex");

  if (cookieVal !== expected) {
    redirect("/site-password");
  }
}
