import Image from "next/image";
import { getSettings } from "@/lib/data/settings";
import type { HomepageConfig, AboutConfig } from "@/types";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await getSettings();
  return {
    title: `About Us | ${settings?.site_title ?? "Our Store"}`,
  };
}

export default async function AboutPage() {
  const settings = await getSettings();
  const homepage = settings?.homepage_config as HomepageConfig | null;
  const about = (settings as any)?.about_config as AboutConfig | null;

  const bgColor = homepage?.bg_color ?? "#ffffff";
  const fontColor = homepage?.font_color ?? "#111827";

  const hasBlock1 = !!(about?.heading1 || about?.body1 || about?.image1_url);
  const hasBlock2 = !!(about?.heading2 || about?.body2 || about?.image2_url);

  return (
    <div style={{ backgroundColor: bgColor, color: fontColor }}>
      <div className="max-w-5xl mx-auto px-6 py-8 md:py-12">
        <div className="space-y-10 md:space-y-14">

          {/* Block 1: text left, image right */}
          {hasBlock1 && (
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
              <div className="flex-1 space-y-3">
                {about?.heading1 && (
                  <h1 className="text-2xl md:text-3xl font-bold leading-tight">{about.heading1}</h1>
                )}
                {about?.body1 && (
                  <p className="text-sm md:text-base leading-relaxed" style={{ opacity: 0.8 }}>
                    {about.body1}
                  </p>
                )}
              </div>
              {about?.image1_url && (
                <div className="flex-1 w-full relative z-50 h-52 md:h-60">
                  <Image
                    src={about.image1_url}
                    alt={about.heading1 ?? "About us"}
                    fill
                    className="object-cover rounded-xl"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              )}
            </div>
          )}

          {/* Block 2: image left, text right */}
          {hasBlock2 && (
            <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10">
              {about?.image2_url && (
                <div className="flex-1 w-full order-2 md:order-1 relative z-50 h-52 md:h-60">
                  <Image
                    src={about.image2_url}
                    alt={about.heading2 ?? "Our mission"}
                    fill
                    className="object-cover rounded-xl"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
              )}
              <div className={`flex-1 space-y-3 ${about?.image2_url ? "order-1 md:order-2" : ""}`}>
                {about?.heading2 && (
                  <h2 className="text-2xl md:text-3xl font-bold leading-tight">{about.heading2}</h2>
                )}
                {about?.body2 && (
                  <p className="text-sm md:text-base leading-relaxed" style={{ opacity: 0.8 }}>
                    {about.body2}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasBlock1 && !hasBlock2 && (
            <div className="text-center py-16" style={{ opacity: 0.4 }}>
              <p className="text-lg">Coming soon</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
