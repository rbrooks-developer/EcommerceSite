"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveEbayCredentials, disconnectEbay } from "@/lib/actions/ebay";
import { CheckCircle, XCircle, Loader2, RefreshCw, Link2Off, Tag, PlugZap } from "lucide-react";
import type { EbayConfig } from "@/types";

interface Props {
  config: EbayConfig | null;
  successParam: string | null;
  errorParam: string | null;
}

function errorMessage(code: string | null) {
  if (!code) return null;
  const map: Record<string, string> = {
    access_denied:         "You cancelled the eBay authorisation.",
    token_exchange_failed: "Token exchange failed — check your App ID, Cert ID, and RuName.",
    missing_credentials:   "Save your credentials first, then try connecting.",
    invalid_state:         "The authorisation request expired. Please try again.",
  };
  return map[code] ?? "Something went wrong. Please try again.";
}

export function EbaySettings({ config, successParam, errorParam }: Props) {
  const isConnected = !!config?.access_token;

  const [credState, credAction, credPending] = useActionState(saveEbayCredentials, null) as [
    { error?: string; success?: true } | null,
    (payload: FormData) => void,
    boolean,
  ];

  const [discState, discAction, discPending] = useActionState(disconnectEbay, null) as [
    { error?: string; success?: true } | null,
    (payload: FormData) => void,
    boolean,
  ];

  const [syncState, setSyncState] = useState<
    { status: "idle" } | { status: "syncing" } | { status: "done"; count: number } | { status: "error"; message: string }
  >({ status: "idle" });

  async function handleSync() {
    setSyncState({ status: "syncing" });
    try {
      const res = await fetch("/api/ebay/categories/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setSyncState({ status: "done", count: data.count });
    } catch (err) {
      setSyncState({ status: "error", message: (err as Error).message });
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

      {/* ── 1. Developer Credentials ──────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Developer Credentials</h2>
          <p className="mt-1 text-sm text-gray-500">
            Found in{" "}
            <a
              href="https://developer.ebay.com/my/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              eBay Developer Portal → Application Keys
            </a>
            . Use the <strong>Production</strong> keys.
          </p>
        </div>

        <form action={credAction} className="space-y-4">
          <div>
            <Label htmlFor="app_id">App ID (Client ID)</Label>
            <Input
              id="app_id"
              name="app_id"
              defaultValue={config?.app_id ?? ""}
              placeholder="YourApp-12345-Production-abcde12345"
              required
            />
          </div>
          <div>
            <Label htmlFor="dev_id">Dev ID</Label>
            <Input
              id="dev_id"
              name="dev_id"
              defaultValue={config?.dev_id ?? ""}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
            />
          </div>
          <div>
            <Label htmlFor="cert_id">Cert ID (Client Secret)</Label>
            <Input
              id="cert_id"
              name="cert_id"
              type="password"
              defaultValue={config?.cert_id ?? ""}
              placeholder="Production-…"
              autoComplete="off"
              required
            />
          </div>
          <div>
            <Label htmlFor="ru_name">RuName</Label>
            <Input
              id="ru_name"
              name="ru_name"
              defaultValue={config?.ru_name ?? ""}
              placeholder="YourApp-YourApp-Produc-abcde"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              eBay Developer Portal → Your App → OAuth credentials → RuName. The callback URL
              registered under that RuName must be{" "}
              <code className="bg-gray-100 px-1 rounded">{process.env.NEXT_PUBLIC_APP_URL}/api/ebay/callback</code>.
            </p>
          </div>

          {credState?.error && (
            <p className="text-sm text-red-600">{credState.error}</p>
          )}
          {credState?.success && (
            <p className="text-sm text-green-600">Credentials saved.</p>
          )}

          <Button type="submit" loading={credPending}>Save Credentials</Button>
        </form>
      </section>

      {/* ── 2. Account Connection ─────────────────────────────── */}
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
                <dd>{new Date(config.token_expires_at).toLocaleString()}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm text-gray-500">
            No eBay account connected. Save your credentials above, then click below to
            authorise via eBay's secure OAuth flow.
          </p>
        )}

        {discState?.error && (
          <p className="text-sm text-red-600">{discState.error}</p>
        )}

        <div className="flex gap-3">
          <a href="/api/ebay/auth">
            <Button variant="default" disabled={!config?.app_id}>
              {isConnected ? (
                <><RefreshCw className="h-4 w-4" /> Reconnect</>
              ) : (
                <><PlugZap className="h-4 w-4" /> Connect eBay Account</>
              )}
            </Button>
          </a>
          {isConnected && (
            <form action={discAction}>
              <Button type="submit" variant="outline" loading={discPending}>
                <Link2Off className="h-4 w-4" />
                Disconnect
              </Button>
            </form>
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
              <dd>{new Date(config.categories_synced_at).toLocaleString()}</dd>
            </div>
            {config.categories_count != null && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Categories stored</dt>
                <dd className="font-medium">{config.categories_count.toLocaleString()}</dd>
              </div>
            )}
          </dl>
        )}

        {syncState.status === "done" && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>Sync complete — {syncState.count.toLocaleString()} categories stored.</span>
          </div>
        )}
        {syncState.status === "error" && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{syncState.message}</span>
          </div>
        )}

        <Button
          onClick={handleSync}
          disabled={!config?.app_id || syncState.status === "syncing"}
          loading={syncState.status === "syncing"}
          variant="outline"
        >
          <Tag className="h-4 w-4" />
          {syncState.status === "syncing" ? "Syncing (this takes ~30s)…" : "Sync eBay Categories"}
        </Button>
      </section>
    </div>
  );
}
