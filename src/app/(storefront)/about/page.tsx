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
      <div className="max-w-6xl mx-auto px-6 py-16 md:py-24">
        <div className="space-y-20 md:space-y-32">

          {/* Block 1: text left, image right */}
          {hasBlock1 && (
            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <div className="flex-1 space-y-5">
                {about?.heading1 && (
                  <h1 className="text-4xl md:text-5xl font-bold leading-tight">{about.heading1}</h1>
                )}
                {about?.body1 && (
                  <p className="text-base md:text-lg leading-relaxed" style={{ opacity: 0.8 }}>
                    {about.body1}
                  </p>
                )}
              </div>
              {about?.image1_url && (
                <div className="flex-1 w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={about.image1_url}
                    alt={about.heading1 ?? "About us"}
                    className="w-full h-72 md:h-80 object-cover rounded-2xl"
                  />
                </div>
              )}
            </div>
          )}

          {/* Block 2: image left, text right */}
          {hasBlock2 && (
            <div className="flex flex-col md:flex-row items-center gap-10 md:gap-16">
              {about?.image2_url && (
                <div className="flex-1 w-full order-2 md:order-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={about.image2_url}
                    alt={about.heading2 ?? "Our mission"}
                    className="w-full h-72 md:h-80 object-cover rounded-2xl"
                  />
                </div>
              )}
              <div className={`flex-1 space-y-5 ${about?.image2_url ? "order-1 md:order-2" : ""}`}>
                {about?.heading2 && (
                  <h2 className="text-4xl md:text-5xl font-bold leading-tight">{about.heading2}</h2>
                )}
                {about?.body2 && (
                  <p className="text-base md:text-lg leading-relaxed" style={{ opacity: 0.8 }}>
                    {about.body2}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!hasBlock1 && !hasBlock2 && (
            <div className="text-center py-24" style={{ opacity: 0.4 }}>
              <p className="text-xl">Coming soon</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
