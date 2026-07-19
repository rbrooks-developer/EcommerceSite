"use client";

import { useState } from "react";
import { useActionState } from "react";
import { saveEbayListingSettings } from "@/lib/actions/ebay";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { CheckCircle, XCircle } from "lucide-react";
import type { EbayConfig } from "@/types";

export function EbayListingSettings({ config, maxSizeMb = 2 }: { config: EbayConfig | null; maxSizeMb?: number }) {
  const cgcCensusUrl = config?.cgc_census_url ?? "";
  const [cgcButtonImageUrl, setCgcButtonImageUrl] = useState<string[]>(
    config?.cgc_button_image_url ? [config.cgc_button_image_url] : []
  );

  const [state, formAction, pending] = useActionState(saveEbayListingSettings, null);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-gray-900">Listing Settings</h2>
        <p className="mt-1 text-sm text-gray-500">
          Settings that control how product listings are displayed on the storefront.
        </p>
      </div>

      <form action={formAction} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="cgc-census-url" className="block text-sm font-medium text-gray-700">
            CGC Census URL
          </label>
          <input
            id="cgc-census-url"
            type="url"
            name="cgc_census_url"
            defaultValue={cgcCensusUrl}
            placeholder="https://www.cgccomics.com/certlookup/"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-gray-400">
            The certification number will be appended to this URL when the CGC Census button is clicked.
            The button appears on product pages whose title contains &quot;CGC&quot; and have a certification number.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            CGC Census Button Image
          </label>
          <ImageUpload
            value={cgcButtonImageUrl}
            onChange={setCgcButtonImageUrl}
            max={1}
            bucket="site-assets"
            pathPrefix="settings"
            maxSizeMb={maxSizeMb}
          />
          <p className="text-xs text-gray-400">
            Optional custom image for the CGC Census button. If not set, a plain text button is shown.
            Recommended size: 460×84px.
          </p>
          <input type="hidden" name="cgc_button_image_url" value={cgcButtonImageUrl[0] ?? ""} />
        </div>

        {state?.success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Listing settings saved.</span>
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
          disabled={pending}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium
                     text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50
                     disabled:cursor-not-allowed transition-colors"
        >
          {pending ? "Saving…" : "Save Listing Settings"}
        </button>
      </form>
    </section>
  );
}
