import type { PromoBanner } from "@/lib/actions/promos";

export function PromoBanner({ banner }: { banner: PromoBanner | null }) {
  if (!banner?.enabled || !banner.html?.trim()) return null;
  return (
    <div
      className="w-full px-4 py-2.5 text-center"
      style={{
        backgroundColor: banner.bg_color ?? "#1a1a1a",
        color: banner.text_color ?? "#ffffff",
        fontSize: banner.font_size ? `${banner.font_size}px` : "14px",
      }}
      dangerouslySetInnerHTML={{ __html: banner.html }}
    />
  );
}
