import { CollectionRequestForm } from "@/components/storefront/CollectionRequestForm";
import { getSettings } from "@/lib/data/settings";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  const title = settings?.site_title ?? "Store";
  return {
    title: `Sell Your Collection — ${title}`,
    description: "Get a quote for your comic collection. Submit photos and details and we'll be in touch with an offer.",
  };
}

export default async function SellCollectionPage() {
  const settings = await getSettings();
  const siteTitle = settings?.site_title ?? "Store";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--site-bg)", color: "var(--site-fg)" }}>

      {/* ── Hero header ─────────────────────────────────── */}
      <div className="relative overflow-hidden">
        {/* Layered glow */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in srgb, var(--site-fg) 35%, transparent), transparent)",
          }}
        />
        <div
          className="absolute inset-0 opacity-10"
          style={{
            background: "radial-gradient(ellipse 40% 40% at 70% 80%, color-mix(in srgb, var(--site-fg) 60%, transparent), transparent)",
          }}
        />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          {/* Eyebrow */}
          <p className="text-xs font-bold tracking-[0.35em] uppercase mb-4 opacity-50">
            {siteTitle}
          </p>

          {/* Headline */}
          <h1
            className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.05] mb-5"
            style={{
              background: `linear-gradient(160deg, color-mix(in srgb, var(--site-fg) 55%, white) 0%, var(--site-fg) 45%, color-mix(in srgb, var(--site-fg) 65%, black) 100%)`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Sell Your Collection
          </h1>

          {/* Sub */}
          <p className="text-base sm:text-lg opacity-60 max-w-xl mx-auto leading-relaxed">
            Fill in your details, describe your collection, and upload some photos.
            We&apos;ll review everything and reach out with a fair offer.
          </p>

          {/* Divider */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <div className="h-px w-16 opacity-20" style={{ backgroundColor: "var(--site-fg)" }} />
            <div className="h-1.5 w-1.5 rounded-full opacity-40" style={{ backgroundColor: "var(--site-fg)" }} />
            <div className="h-px w-16 opacity-20" style={{ backgroundColor: "var(--site-fg)" }} />
          </div>
        </div>
      </div>

      {/* ── Form card ───────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-24">
        <div
          className="rounded-3xl border p-6 sm:p-10 shadow-2xl"
          style={{
            backgroundColor: "color-mix(in srgb, var(--site-fg) 5%, var(--site-bg))",
            borderColor: "color-mix(in srgb, var(--site-fg) 12%, transparent)",
          }}
        >
          <CollectionRequestForm />
        </div>

        {/* Trust line */}
        <p className="text-center text-xs opacity-30 mt-6 tracking-wide" style={{ color: "var(--site-fg)" }}>
          Your information is kept private and used only to evaluate your collection.
        </p>
      </div>

    </div>
  );
}
