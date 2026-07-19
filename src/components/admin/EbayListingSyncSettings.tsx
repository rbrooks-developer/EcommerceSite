"use client";

import { useActionState } from "react";
import { saveEbayListingSyncSettings } from "@/lib/actions/ebay";
import { EbayListingSyncButton } from "@/components/admin/EbayListingSyncButton";
import { CheckCircle, XCircle } from "lucide-react";
import type { EbayConfig } from "@/types";

export function EbayListingSyncSettings({ config }: { config: EbayConfig | null }) {
  const isConnected = !!config?.access_token;
  const enabled     = config?.listing_sync_enabled  ?? false;
  const lastRun     = config?.listing_sync_last_run ?? null;

  const [state, formAction, pending] = useActionState(saveEbayListingSyncSettings, null);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Listing Sync Service</h2>
        <p className="mt-1 text-sm text-gray-500">
          Imports all active Fixed Price eBay listings into the website products table.
          Products are matched to website categories via the eBay category mapping above.
          When enabled, the cron job runs this automatically on a schedule configured in
          cron-job.org. You can also trigger a manual sync at any time with the button below.
        </p>
      </div>

      {lastRun && (
        <p className="text-sm text-gray-500" suppressHydrationWarning>
          Last scheduled run: {new Date(lastRun).toLocaleString()}
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
            Connect your eBay account above to enable listing sync.
          </p>
        )}
      </form>

      <div className="border-t border-gray-100 pt-4">
        <EbayListingSyncButton disabled={!isConnected} />
      </div>
    </section>
  );
}
