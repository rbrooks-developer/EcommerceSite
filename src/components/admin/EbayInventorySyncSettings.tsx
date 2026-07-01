"use client";

import { useActionState } from "react";
import { saveEbayInventorySyncSettings } from "@/lib/actions/ebay";
import { EbayInventorySyncButton } from "@/components/admin/EbayInventorySyncButton";
import { CheckCircle, XCircle } from "lucide-react";
import type { EbayConfig } from "@/types";

export function EbayInventorySyncSettings({
  config,
}: {
  config: EbayConfig | null;
}) {
  const isConnected    = !!config?.access_token;
  const enabled        = config?.inventory_sync_enabled          ?? false;
  const intervalHours  = Math.max(1, Math.round((config?.inventory_sync_interval_minutes ?? 60) / 60));
  const lastRun        = config?.inventory_sync_last_run         ?? null;
  const discountPct    = config?.price_discount_percent          ?? 0;

  const [state, formAction, pending] = useActionState(saveEbayInventorySyncSettings, null);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Inventory Sync Service</h2>
        <p className="mt-1 text-sm text-gray-500">
          Automatically updates product inventory from eBay on a schedule. eBay is the
          source of truth — quantities are pulled via the Trading API and written to the
          website. If a listing no longer exists on eBay, the product inventory is set to
          0 (out of stock). On the Hobby plan the cron runs once daily.
        </p>
      </div>

      {lastRun && (
        <p className="text-sm text-gray-500" suppressHydrationWarning>
          Last synced: {new Date(lastRun).toLocaleString()}
        </p>
      )}

      <form action={formAction} className="space-y-5">
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
            Sync every (hours)
          </label>
          <input
            id="inv-interval"
            type="number"
            name="interval_hours"
            defaultValue={intervalHours}
            min={1}
            max={24}
            disabled={!isConnected}
            className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <span className="text-xs text-gray-400">1–24 hours</span>
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="ebay-discount" className="text-sm text-gray-700 shrink-0 w-40">
            eBay Price Discount
          </label>
          <input
            id="ebay-discount"
            type="number"
            name="price_discount_percent"
            defaultValue={discountPct}
            min={0}
            max={99}
            step={1}
            disabled={!isConnected}
            className="w-24 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
          <span className="text-xs text-gray-400">
            % off eBay price on import{discountPct > 0 ? ` — e.g. $1,000 → $${(1000 * (1 - discountPct / 100)).toFixed(2)}` : " (0 = no discount)"}
          </span>
        </div>

        {state?.success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Sync settings saved.</span>
          </div>
        )}
        {state?.error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{state.error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!isConnected || pending}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium
                     text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Saving…" : "Save Sync Settings"}
        </button>

        {!isConnected && (
          <p className="text-xs text-gray-400">
            Connect your eBay account above to enable inventory sync.
          </p>
        )}
      </form>

      <div className="pt-1 border-t border-gray-100 pt-4">
        <EbayInventorySyncButton disabled={!isConnected} />
      </div>
    </section>
  );
}
