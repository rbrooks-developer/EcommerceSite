import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Routes any Supabase Storage URL through Vercel's CDN edge proxy so that
// Vercel absorbs repeat traffic and Supabase egress drops to near zero.
// Works in server and client components (NEXT_PUBLIC_SUPABASE_URL is inlined
// at build time). Passes non-Supabase URLs through unchanged — safe to call
// on any image source.
export function imgUrl(url: string | null | undefined): string {
  if (!url) return "";
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const prefix = `${base}/storage/v1/object/public/`;
  if (base && url.startsWith(prefix)) {
    return `/api/img/${url.slice(prefix.length)}`;
  }
  return url;
}

// Routes a remote (e.g. Supabase Storage) image through Next's built-in
// /_next/image optimizer so OG/Twitter crawlers fetch it from our own
// domain at a compressed size — Supabase Storage serves public objects
// with `x-robots-tag: none`, which Apple's iMessage link-preview crawler
// is stricter about honoring than other social scrapers, and the
// uncompressed source files are well above the size link previews want.
export function ogImageUrl(rawUrl: string): string {
  return `/_next/image?url=${encodeURIComponent(rawUrl)}&w=1200&q=75`;
}
