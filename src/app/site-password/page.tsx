import Image from "next/image";
import { getSettings } from "@/lib/data/settings";
import type { HomepageConfig } from "@/types";
import type { Metadata } from "next";
import { SitePasswordForm } from "./SitePasswordForm";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SitePasswordPage() {
  const settings = await getSettings();
  const homepage = settings?.homepage_config as HomepageConfig | null;
  const bgColor = homepage?.bg_color ?? "#0a0a0a";
  const fontColor = homepage?.font_color ?? "#ffffff";
  const siteTitle = settings?.site_title ?? "My Store";
  const logoUrl = settings?.logo_url ?? null;

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: bgColor, color: fontColor }}
    >
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          {logoUrl ? (
            <Image src={logoUrl} alt={siteTitle} width={64} height={64} className="object-contain mx-auto" />
          ) : (
            <h1 className="text-2xl font-bold">{siteTitle}</h1>
          )}
          <p className="text-sm" style={{ opacity: 0.6 }}>
            Enter the password to continue
          </p>
        </div>

        <SitePasswordForm bgColor={bgColor} fontColor={fontColor} />
      </div>
    </div>
  );
}
