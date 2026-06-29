"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { disconnectEbay } from "@/lib/actions/ebay";
import { CheckCircle, XCircle, Loader2, RefreshCw, Link2Off, Tag, PlugZap } from "lucide-react";
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

  type SyncError = { listingId: string; title: string; reason: string };
  type DebugItem = {
    title: string;
    brand: string | null;
    specificsKeys: string;
    parentCategory: string;
    childCategory: string | null;
  };

  type ListingSyncState =
    | { status: "idle" }
    | { status: "fetching" }
    | { status: "syncing"; current: number; total: number; inserted: number; updated: number; lastTitle: string }
    | { status: "done"; inserted: number; updated: number; errors: SyncError[]; debugItems: DebugItem[] }
    | { status: "error"; message: string };

  const [listingSyncState, setListingSyncState] = useState<ListingSyncState>({ status: "idle" });

  async function handleListingSync() {
    setListingSyncState({ status: "fetching" });
    try {
      const res = await fetch("/api/ebay/listings/sync", { method: "POST" });
      if (!res.body) throw new Error("No response body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let   inserted = 0, updated = 0, total = 0;
      const errors: SyncError[] = [];
      const debugItems: DebugItem[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line);
            if (msg.type === "fetching") {
              setListingSyncState({ status: "fetching" });
            } else if (msg.type === "total") {
              total = msg.count;
              setListingSyncState({ status: "syncing", current: 0, total, inserted: 0, updated: 0, lastTitle: "" });
            } else if (msg.type === "item") {
              if (msg.status === "inserted") inserted++;
              if (msg.status === "updated")  updated++;
              if (msg.status === "skipped")  errors.push({ listingId: "", title: msg.title, reason: msg.reason });
              debugItems.push({
                title:          msg.title,
                brand:          msg.brand ?? null,
                specificsKeys:  msg.specifics ? Object.keys(msg.specifics).join(", ") : "",
                parentCategory: msg.parentCategory ?? "",
                childCategory:  msg.childCategory ?? null,
              });
              setListingSyncState({ status: "syncing", current: msg.current, total, inserted, updated, lastTitle: msg.title });
            } else if (msg.type === "done") {
              setListingSyncState({ status: "done", inserted: msg.inserted, updated: msg.updated, errors: msg.errors ?? [], debugItems });
            } else if (msg.type === "fatal") {
              setListingSyncState({ status: "error", message: msg.message });
            }
          } catch { /* ignore malformed line */ }
        }
      }
    } catch (err) {
      setListingSyncState({ status: "error", message: (err as Error).message });
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

      {/* ── 1. Credentials status ─────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Developer Credentials</h2>
            <p className="mt-1 text-sm text-gray-500">
              Set via Vercel environment variables — no form needed.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
              credentialsConfigured
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-600"
            }`}
          >
            {credentialsConfigured ? (
              <><CheckCircle className="h-3 w-3" /> Configured</>
            ) : (
              <><XCircle className="h-3 w-3" /> Missing</>
            )}
          </span>
        </div>

        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {(["EBAY_APP_ID", "EBAY_DEV_ID", "EBAY_CERT_ID", "EBAY_RU_NAME"] as const).map((varName) => (
            <div key={varName} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
              <dt className="font-mono text-xs text-gray-500">{varName}</dt>
              <dd className="text-xs text-gray-400">set in Vercel</dd>
            </div>
          ))}
        </dl>

        {!credentialsConfigured && (
          <p className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            Add <code className="font-mono">EBAY_APP_ID</code>, <code className="font-mono">EBAY_CERT_ID</code>,
            and <code className="font-mono">EBAY_RU_NAME</code> (and optionally <code className="font-mono">EBAY_DEV_ID</code>)
            to your Vercel project environment variables, then redeploy.
          </p>
        )}
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

      {/* ── 4. Listing Sync ───────────────────────────────────── */}
      <section className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Listing Sync</h2>
          <p className="mt-1 text-sm text-gray-500">
            Imports all active Fixed Price eBay listings into the website products table.
            Products are matched to website categories via the eBay category mapping above.
            If a matched category has children, the item&apos;s Brand is used to route to the
            correct child category. Re-run at any time to update prices, inventory, and details.
          </p>
        </div>

        {config?.listings_synced_at && (
          <dl className="text-sm space-y-1">
            <div className="flex justify-between">
              <dt className="text-gray-500">Last synced</dt>
              <dd suppressHydrationWarning>{new Date(config.listings_synced_at).toLocaleString()}</dd>
            </div>
            {config.listings_count != null && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Products synced</dt>
                <dd className="font-medium">{config.listings_count.toLocaleString()}</dd>
              </div>
            )}
          </dl>
        )}

        {/* Live progress */}
        {(listingSyncState.status === "fetching" || listingSyncState.status === "syncing") && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
            {listingSyncState.status === "fetching" ? (
              <div className="flex items-center gap-2 text-sm text-blue-700">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Fetching active listings from eBay…
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm text-blue-800">
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                    Processing {listingSyncState.current} of {listingSyncState.total}
                  </span>
                  <span className="font-medium tabular-nums">
                    {listingSyncState.total > 0
                      ? Math.round((listingSyncState.current / listingSyncState.total) * 100)
                      : 0}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="h-1.5 w-full rounded-full bg-blue-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-150"
                    style={{ width: listingSyncState.total > 0 ? `${(listingSyncState.current / listingSyncState.total) * 100}%` : "0%" }}
                  />
                </div>

                <div className="flex gap-4 text-xs text-blue-700">
                  <span>{listingSyncState.inserted} inserted</span>
                  <span>{listingSyncState.updated} updated</span>
                </div>

                {listingSyncState.lastTitle && (
                  <p className="text-xs text-blue-600 truncate">{listingSyncState.lastTitle}</p>
                )}
              </>
            )}
          </div>
        )}

        {/* Done */}
        {listingSyncState.status === "done" && (
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
              <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Sync complete — {listingSyncState.inserted.toLocaleString()} inserted,{" "}
                {listingSyncState.updated.toLocaleString()} updated.
                {listingSyncState.errors.length > 0 && (
                  <> {listingSyncState.errors.length} listing{listingSyncState.errors.length > 1 ? "s" : ""} skipped (see below).</>
                )}
              </span>
            </div>

            {listingSyncState.errors.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-medium text-amber-800 mb-2">
                  Skipped — map these eBay categories in Admin → Categories:
                </p>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {listingSyncState.errors.map((e, i) => (
                    <div key={i} className="text-xs text-amber-700">
                      <span className="font-medium">{e.title}</span>
                      <br />
                      <span className="text-amber-600">{e.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Category routing debug table */}
            {listingSyncState.debugItems.length > 0 && (
              <details className="rounded-lg border border-gray-200 bg-gray-50">
                <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-gray-600 hover:text-gray-900">
                  Category routing debug ({listingSyncState.debugItems.length} items)
                </summary>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-100">
                      <tr>
                        <th className="px-2 py-1 text-left font-medium text-gray-600 min-w-[180px]">Title</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-600">Detected Brand</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-600">Specifics Keys</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-600">Parent</th>
                        <th className="px-2 py-1 text-left font-medium text-gray-600">Child</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listingSyncState.debugItems.map((d, i) => (
                        <tr key={i} className={`border-t border-gray-200 ${!d.childCategory && d.parentCategory ? "bg-amber-50" : ""}`}>
                          <td className="px-2 py-1 text-gray-700 max-w-[220px] truncate" title={d.title}>{d.title}</td>
                          <td className="px-2 py-1 font-mono text-gray-900">{d.brand ?? <span className="text-red-500">null</span>}</td>
                          <td className="px-2 py-1 text-gray-500 max-w-[160px] truncate" title={d.specificsKeys}>{d.specificsKeys || <span className="text-red-500">empty</span>}</td>
                          <td className="px-2 py-1 text-gray-700">{d.parentCategory}</td>
                          <td className="px-2 py-1 font-medium text-gray-900">{d.childCategory ?? <span className="text-amber-600">—</span>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        )}

        {listingSyncState.status === "error" && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{listingSyncState.message}</span>
          </div>
        )}

        <Button
          onClick={handleListingSync}
          disabled={!isConnected || listingSyncState.status === "fetching" || listingSyncState.status === "syncing"}
          loading={listingSyncState.status === "fetching" || listingSyncState.status === "syncing"}
          variant="outline"
        >
          <RefreshCw className="h-4 w-4" />
          {listingSyncState.status === "fetching" || listingSyncState.status === "syncing"
            ? "Syncing…"
            : "Sync eBay Listings"}
        </Button>

        {!isConnected && (
          <p className="text-xs text-gray-400">Connect your eBay account above before syncing listings.</p>
        )}
      </section>
    </div>
  );
}
