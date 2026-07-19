"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { disconnectEbay, manualRefreshEbayToken } from "@/lib/actions/ebay";
import { CheckCircle, XCircle, Loader2, RefreshCw, RefreshCcw, Link2Off, Tag, PlugZap } from "lucide-react";
import type { EbayConfig } from "@/types";

interface Props {
  config: EbayConfig | null;
  credentialsConfigured: boolean;
  successParam: string | null;
  errorParam: string | null;
}


function errorMessage(code: string | null) {
  if (!code) return null;
  const map: Record<string, string> = {
    access_denied:         "You cancelled the eBay authorisation.",
    token_exchange_failed: "Token exchange failed — check your Vercel env vars (EBAY_APP_ID, EBAY_CERT_ID, EBAY_RU_NAME).",
    missing_credentials:   "eBay credentials are not configured. Add EBAY_APP_ID, EBAY_CERT_ID, and EBAY_RU_NAME to your Vercel environment variables.",
    invalid_state:         "The authorisation request expired. Please try again.",
    server_error:          "An unexpected server error occurred. Check Vercel function logs.",
    unauthorized:          "You must be logged in as admin.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

export function EbaySettings({ config, credentialsConfigured, successParam, errorParam }: Props) {
  const isConnected = !!config?.access_token;

  const [discState, discAction, discPending] = useActionState(disconnectEbay, null) as [
    { error?: string; success?: true } | null,
    (payload: FormData) => void,
    boolean,
  ];

  const [refreshState, refreshAction, refreshPending] = useActionState(manualRefreshEbayToken, null) as [
    { error?: string; success?: true } | null,
    (payload: FormData) => void,
    boolean,
  ];

  type SyncState =
    | { status: "idle" }
    | { status: "syncing" }
    | { status: "done"; count: number }
    | { status: "error"; message: string };

  const [catSyncState, setCatSyncState] = useState<SyncState>({ status: "idle" });

  async function handleCatSync() {
    setCatSyncState({ status: "syncing" });
    try {
      const res  = await fetch("/api/ebay/categories/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setCatSyncState({ status: "done", count: data.count });
    } catch (err) {
      setCatSyncState({ status: "error", message: (err as Error).message });
    }
  }

  return (
    <div className="space-y-8">

      {/* ── OAuth result notices ───────────────────────────────── */}
      {successParam === "connected" && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <CheckCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>eBay account connected successfully.</span>
        </div>
      )}
      {errorParam && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <XCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{errorMessage(errorParam)}</span>
        </div>
      )}

      {/* ── 1. Account Connection ─────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Account Connection</h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isConnected
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {isConnected ? (
              <><CheckCircle className="h-3 w-3" /> Connected</>
            ) : (
              <><XCircle className="h-3 w-3" /> Not connected</>
            )}
          </span>
        </div>

        {isConnected && config ? (
          <dl className="text-sm space-y-2">
            {config.ebay_username && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Seller ID</dt>
                <dd className="font-mono font-medium">{config.ebay_username}</dd>
              </div>
            )}
            {config.token_expires_at && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Token expires</dt>
                <dd suppressHydrationWarning>{new Date(config.token_expires_at).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-gray-500">
            No eBay account connected. Click below to authorise via eBay's secure OAuth flow.
          </p>
        )}

        {discState?.error && (
          <p className="text-sm text-red-600">{discState.error}</p>
        )}
        {refreshState?.success && (
          <p className="text-sm text-green-600">Token refreshed.</p>
        )}
        {refreshState?.error && (
          <p className="text-sm text-red-600">{refreshState.error}</p>
        )}

        <div className="flex gap-3">
          <a href="/api/ebay/auth">
            <Button variant="default" disabled={!credentialsConfigured}>
              {isConnected ? (
                <><RefreshCw className="h-4 w-4" /> Reconnect</>
              ) : (
                <><PlugZap className="h-4 w-4" /> Connect eBay Account</>
              )}
            </Button>
          </a>
          {isConnected && (
            <>
              <form action={refreshAction}>
                <Button type="submit" variant="outline" loading={refreshPending}>
                  <RefreshCcw className="h-4 w-4" />
                  Refresh Token
                </Button>
              </form>
              <form action={discAction}>
                <Button type="submit" variant="outline" loading={discPending}>
                  <Link2Off className="h-4 w-4" />
                  Disconnect
                </Button>
              </form>
            </>
          )}
        </div>
      </section>

      {/* ── 3. Category Sync ──────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">eBay Category Tree</h2>
          <p className="mt-1 text-sm text-gray-500">
            Downloads the full US eBay category tree (~20,000 categories) and stores it
            locally so you can map your store categories to eBay categories. Re-sync if eBay
            updates their taxonomy.
          </p>
        </div>

        {config?.categories_synced_at && (
          <dl className="text-sm space-y-1">
            <div className="flex justify-between">
              <dt className="text-gray-500">Last synced</dt>
              <dd suppressHydrationWarning>{new Date(config.categories_synced_at).toLocaleString()}</dd>
            </div>
            {config.categories_count != null && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Categories stored</dt>
                <dd className="font-medium">{config.categories_count.toLocaleString()}</dd>
              </div>
            )}
          </dl>
        )}

        {catSyncState.status === "done" && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Sync complete — {catSyncState.count.toLocaleString()} categories stored.</span>
          </div>
        )}
        {catSyncState.status === "error" && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{catSyncState.message}</span>
          </div>
        )}

        <Button
          onClick={handleCatSync}
          disabled={!credentialsConfigured || catSyncState.status === "syncing"}
          loading={catSyncState.status === "syncing"}
          variant="outline"
        >
          <Tag className="h-4 w-4" />
          {catSyncState.status === "syncing" ? "Syncing (this takes ~30s)…" : "Sync eBay Categories"}
        </Button>
      </section>

    </div>
  );
}
