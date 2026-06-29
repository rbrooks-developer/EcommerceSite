import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { saveEbayConfig } from "@/lib/ebay/auth";
import { CheckCircle } from "lucide-react";
import type { EbayConfig } from "@/types";

export function EbayInventorySyncSettings({
  config,
  saved,
}: {
  config: EbayConfig | null;
  saved?: boolean;
}) {
  const isConnected     = !!config?.access_token;
  const enabled         = config?.inventory_sync_enabled          ?? false;
  const intervalMinutes = config?.inventory_sync_interval_minutes ?? 60;
  const lastRun         = config?.inventory_sync_last_run         ?? null;

  async function saveSettings(formData: FormData) {
    "use server";
    const auth = await requireAdmin();
    if (auth.error) return;
    const isEnabled   = formData.has("enabled");
    const intervalVal = Math.max(5, Number(formData.get("interval_minutes")) || 60);
    await saveEbayConfig({
      inventory_sync_enabled:          isEnabled,
      inventory_sync_interval_minutes: intervalVal,
    });
    revalidatePath("/admin/ebay");
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Inventory Sync Service</h2>
        <p className="mt-1 text-sm text-gray-500">
          Automatically updates product inventory from eBay on a schedule. eBay is the
          source of truth — quantities are pulled via the Trading API and written to the
          website. If a listing no longer exists on eBay the product inventory is set to 0.
          Requires Vercel Pro for intervals under 60 minutes.
        </p>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 shrink-0" />
          Settings saved.
        </div>
      )}

      {lastRun && (
        <p className="text-sm text-gray-500" suppressHydrationWarning>
          Last synced: {new Date(lastRun).toLocaleString()}
        </p>
      )}

      <form action={saveSettings} className="space-y-5">
        <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={enabled}
            disabled={!isConnected}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
          />
          <span className="text-sm font-medium text-gray-700">Enable automatic sync</span>
        </label>

        <div className="flex items-center gap-3">
          <label htmlFor="inv-interval" className="text-sm text-gray-700 shrink-0 w-40">
            Sync every (minutes)
          </label>
          <input
            id="inv-interval"
            type="number"
            name="interval_minutes"
            defaultValue={intervalMinutes}
            min={5}
            max={1440}
            disabled={!isConnected}
            className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <span className="text-xs text-gray-400">min 5, max 1440 (24 h)</span>
        </div>

        <button
          type="submit"
          disabled={!isConnected}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium
                     text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          Save Sync Settings
        </button>

        {!isConnected && (
          <p className="text-xs text-gray-400">Connect your eBay account above to enable inventory sync.</p>
        )}
      </form>
    </section>
  );
}
