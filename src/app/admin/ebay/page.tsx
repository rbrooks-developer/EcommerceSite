import { getEbayConfig } from "@/lib/ebay/auth";
import { getSettings } from "@/lib/data/settings";
import { EbaySettings } from "@/components/admin/EbaySettings";
import { EbayInventorySyncSettings } from "@/components/admin/EbayInventorySyncSettings";
import { EbayListingSettings } from "@/components/admin/EbayListingSettings";

export const dynamic = "force-dynamic";

export default async function EbayAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const [config, params, settings] = await Promise.all([getEbayConfig(), searchParams, getSettings()]);
  const success = params.success ?? null;
  const error   = params.error   ?? null;

  // Credentials come from env vars — check independently of token state
  const credentialsConfigured = !!(
    process.env.EBAY_APP_ID &&
    process.env.EBAY_CERT_ID &&
    process.env.EBAY_RU_NAME
  );

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">eBay API Sync</h1>
        <p className="mt-1 text-sm text-gray-500">
          Connect your eBay seller account and sync the eBay category tree.
        </p>
      </div>
      <EbaySettings
        config={config}
        credentialsConfigured={credentialsConfigured}
        successParam={success}
        errorParam={error}
      />
      <EbayInventorySyncSettings config={config} />
      <EbayListingSettings config={config} maxSizeMb={(settings as any)?.max_image_size_mb ?? 2} />
    </div>
  );
}
