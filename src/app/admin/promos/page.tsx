import { createServiceClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import Link from "next/link";
import { Plus } from "lucide-react";
import { BannerForm } from "./BannerForm";
import { PromoToggle } from "./PromoToggle";
import type { PromoBanner } from "@/lib/actions/promos";

export const metadata = { title: "Promos" };

type PromoRow = {
  id: string;
  code: string;
  description: string | null;
  enabled: boolean;
  discount_type: "percentage" | "fixed" | "free_shipping";
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  expiration_date: string | null;
  created_at: string;
};

function statusBadge(promo: PromoRow) {
  if (!promo.enabled) return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">Disabled</span>;
  if (promo.expiration_date && new Date(promo.expiration_date) < new Date()) return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">Expired</span>;
  if (promo.max_uses != null && promo.current_uses >= promo.max_uses) return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Limit reached</span>;
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Active</span>;
}

function discountLabel(promo: PromoRow) {
  if (promo.discount_type === "percentage") return `${promo.discount_value}% off`;
  if (promo.discount_type === "fixed") return `$${promo.discount_value.toFixed(2)} off`;
  return "Free shipping";
}

export default async function PromosPage() {
  const [sb, settings] = await Promise.all([createServiceClient(), getSettings()]);

  const { data } = await sb
    .from("promos")
    .select("id, code, description, enabled, discount_type, discount_value, max_uses, current_uses, expiration_date, created_at")
    .order("created_at", { ascending: false });

  const promos = (data ?? []) as PromoRow[];

  const defaultBanner: PromoBanner = { enabled: false, html: "", bg_color: "#1a1a1a", text_color: "#ffffff", font_size: "14" };
  const rawBanner = (settings as any)?.promo_banner;
  const banner: PromoBanner = rawBanner
    ? { ...defaultBanner, ...(rawBanner as object) }
    : defaultBanner;

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Promos</h1>
        <Link
          href="/admin/promos/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
        >
          <Plus className="h-4 w-4" />
          New Promo
        </Link>
      </div>

      {/* Banner management */}
      <BannerForm initial={banner} />

      {/* Promo code list */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-gray-100">Promo Codes ({promos.length})</h2>
        </div>
        {promos.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            No promo codes yet.{" "}
            <Link href="/admin/promos/new" className="text-indigo-600 hover:text-indigo-500">Create one</Link>.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
              <tr>
                {["Code", "Discount", "Uses", "Status", "Expires", ""].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {promos.map((promo) => (
                <tr key={promo.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-mono font-semibold text-gray-900 dark:text-gray-100">{promo.code}</p>
                      {promo.description && <p className="text-xs text-gray-400 mt-0.5">{promo.description}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{discountLabel(promo)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {promo.current_uses}{promo.max_uses != null ? ` / ${promo.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-3">{statusBadge(promo)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {promo.expiration_date ? new Date(promo.expiration_date).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <PromoToggle id={promo.id} enabled={promo.enabled} />
                      <Link href={`/admin/promos/${promo.id}/edit`} className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">Edit</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
