"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, AlertCircle, Copy, Check, Loader2 } from "lucide-react";
import { installFeature } from "@/lib/actions/setup";
import { FEATURE_SQL } from "@/lib/setup-sql";
import type { FeatureResult, SetupStatus } from "@/lib/actions/setup";

// ─── Helpers ───────────────────────────────────────────────────────────────

function StatusIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
    : <XCircle className="h-4 w-4 text-red-400 shrink-0" />;
}

function CopyButton({ sql }: { sql: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(sql).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
    >
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied!" : "Copy SQL"}
    </button>
  );
}

// ─── Feature card ──────────────────────────────────────────────────────────

type InstallableFeature = keyof typeof FEATURE_SQL;

function FeatureCard({
  title,
  description,
  feature,
  hasManagementToken,
  featureId,
}: {
  title: string;
  description: string;
  feature: FeatureResult;
  hasManagementToken: boolean;
  featureId?: InstallableFeature;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleInstall() {
    if (!featureId) return;
    setError(null);
    startTransition(async () => {
      const result = await installFeature(featureId);
      if (result.error) setError(result.error);
      else setSuccess(true);
    });
  }

  const canInstall = featureId && feature.sql && !feature.ok;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {feature.ok || success
              ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
              : <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            }
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
          </div>
          <p className="text-xs text-gray-500 mt-0.5 ml-7">{description}</p>
        </div>

        {canInstall && !success && (
          <div className="flex items-center gap-2 shrink-0">
            {hasManagementToken ? (
              <button
                onClick={handleInstall}
                disabled={isPending}
                className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors"
              >
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                {isPending ? "Installing…" : "Install"}
              </button>
            ) : null}
            <CopyButton sql={feature.sql!} />
          </div>
        )}
      </div>

      <ul className="space-y-1.5 ml-2">
        {feature.items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-xs text-gray-600">
            <StatusIcon ok={item.ok} />
            <span className={item.ok ? "" : "text-red-500"}>{item.label}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}
      {success && (
        <p className="text-xs text-green-600 bg-green-50 rounded-md px-3 py-2">
          Installed successfully. Refresh this page to verify.
        </p>
      )}
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────

export function SetupClient({ status }: { status: SetupStatus }) {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Management API banner */}
      <div className={`rounded-lg px-4 py-3 text-sm flex items-start gap-3 ${
        status.hasManagementToken
          ? "bg-green-50 border border-green-200 text-green-800"
          : "bg-amber-50 border border-amber-200 text-amber-800"
      }`}>
        {status.hasManagementToken
          ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
          : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
        }
        <span>
          {status.hasManagementToken
            ? "Supabase Management API connected — Install buttons are active."
            : <>
                <strong>One-click install is disabled.</strong> Add <code className="font-mono bg-amber-100 px-1 rounded">SUPABASE_ACCESS_TOKEN</code> to your Vercel environment variables to enable it. Get the token from{" "}
                <span className="underline">Supabase Dashboard → Account → Access Tokens</span>.
                Until then, use the <strong>Copy SQL</strong> buttons and paste into the Supabase SQL Editor.
              </>
          }
        </span>
      </div>

      {/* Database features */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Database</h2>
        <div className="space-y-3">
          <FeatureCard
            title="Core Schema"
            description="orders, products, site_settings — required for the site to function"
            feature={status.core}
            hasManagementToken={status.hasManagementToken}
          />
          <FeatureCard
            title="Promo System"
            description="Promo codes, cart promos, redemption tracking, and discount columns on orders"
            feature={status.promos}
            hasManagementToken={status.hasManagementToken}
            featureId="promos"
          />
          <FeatureCard
            title="eBay Integration"
            description="ebay_config column in site_settings + eBay API credentials"
            feature={status.ebay}
            hasManagementToken={status.hasManagementToken}
            featureId="ebay"
          />
          <FeatureCard
            title="About Us Page"
            description="about_config column in site_settings — required for the /about page to save content"
            feature={status.aboutUs}
            hasManagementToken={status.hasManagementToken}
            featureId="aboutUs"
          />
        </div>
      </section>

      {/* Services */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Environment Variables</h2>
        <p className="text-xs text-gray-500 mb-3">These must be set in your Vercel project settings — they cannot be installed from here.</p>
        <div className="space-y-3">
          <FeatureCard
            title="Stripe Payments"
            description="Required for checkout and order processing"
            feature={status.stripe}
            hasManagementToken={status.hasManagementToken}
          />
          <FeatureCard
            title="EasyPost Shipping"
            description="Required for shipping rate quotes and label generation"
            feature={status.easypost}
            hasManagementToken={status.hasManagementToken}
          />
          <FeatureCard
            title="Resend Email"
            description="Required for order confirmation and shipping notification emails"
            feature={status.resend}
            hasManagementToken={status.hasManagementToken}
          />
          <FeatureCard
            title="eBay Inventory Sync (cron-job.org)"
            description="The sync runs on demand — schedule it at cron-job.org (free). Create a job: URL = https://[your-domain]/api/cron/ebay-inventory-sync · Method = GET · Header: Authorization: Bearer [CRON_SECRET value from Vercel]. Set the schedule to whatever frequency you want (e.g. every hour). NEXT_PUBLIC_APP_URL is also required for order confirmation emails."
            feature={status.cron}
            hasManagementToken={status.hasManagementToken}
          />
        </div>
      </section>

      {/* eBay connection link */}
      {status.ebay.items.find((i) => i.label === "EBAY_APP_ID" && i.ok) && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Connected Services</h2>
          <div className="rounded-lg border border-gray-200 bg-white p-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">eBay Account</h3>
              <p className="text-xs text-gray-500 mt-0.5">Authorize eBay OAuth to enable inventory sync</p>
            </div>
            <a
              href="/admin/ebay"
              className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Go to eBay Settings →
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
