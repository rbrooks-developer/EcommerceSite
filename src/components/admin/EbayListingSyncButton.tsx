"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import type { ListingSyncError } from "@/lib/ebay/listingSync";

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

type SyncState =
  | { status: "idle" }
  | { status: "fetching" }
  | { status: "enriching"; current: number; count: number }
  | { status: "syncing"; current: number; total: number; inserted: number; updated: number; lastTitle: string }
  | { status: "done"; inserted: number; updated: number; errors: ListingSyncError[] }
  | { status: "error"; message: string };

export function EbayListingSyncButton({ disabled }: { disabled?: boolean }) {
  const [state, setState] = useState<SyncState>({ status: "idle" });

  async function handleSync() {
    setState({ status: "fetching" });
    try {
      const res = await fetch("/api/ebay/listings/sync", { method: "POST" });
      if (!res.body) throw new Error("No response body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let   inserted = 0, updated = 0, total = 0;

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
              setState({ status: "fetching" });
            } else if (msg.type === "enriching") {
              setState({ status: "enriching", current: msg.current ?? 0, count: msg.count });
              await nextFrame();
            } else if (msg.type === "total") {
              total = msg.count;
              setState({ status: "syncing", current: 0, total, inserted: 0, updated: 0, lastTitle: "" });
            } else if (msg.type === "item") {
              if (msg.status === "inserted") inserted++;
              if (msg.status === "updated")  updated++;
              setState({ status: "syncing", current: msg.current, total, inserted, updated, lastTitle: msg.title });
              await nextFrame();
            } else if (msg.type === "done") {
              setState({ status: "done", inserted: msg.inserted, updated: msg.updated, errors: msg.errors ?? [] });
            } else if (msg.type === "fatal") {
              setState({ status: "error", message: msg.message });
            }
          } catch { /* ignore malformed line */ }
        }
      }
    } catch (err) {
      setState({ status: "error", message: (err as Error).message });
    }
  }

  const busy = state.status === "fetching" || state.status === "enriching" || state.status === "syncing";

  return (
    <div className="space-y-3">
      {busy && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          {state.status === "fetching" ? (
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Fetching active listings from eBay…
            </div>
          ) : state.status === "enriching" ? (
            <>
              <div className="flex items-center justify-between text-sm text-blue-800">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Fetching item specifics {state.current} of {state.count}
                </span>
                <span className="font-medium tabular-nums">
                  {state.count > 0 ? Math.round((state.current / state.count) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-blue-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-150"
                  style={{ width: state.count > 0 ? `${(state.current / state.count) * 100}%` : "0%" }}
                />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm text-blue-800">
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                  Processing {state.current} of {state.total}
                </span>
                <span className="font-medium tabular-nums">
                  {state.total > 0 ? Math.round((state.current / state.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-blue-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-150"
                  style={{ width: state.total > 0 ? `${(state.current / state.total) * 100}%` : "0%" }}
                />
              </div>
              <div className="flex gap-4 text-xs text-blue-700">
                <span>{state.inserted} inserted</span>
                <span>{state.updated} updated</span>
              </div>
              {state.lastTitle && (
                <p className="text-xs text-blue-600 truncate">{state.lastTitle}</p>
              )}
            </>
          )}
        </div>
      )}

      {state.status === "done" && (
        <div className="space-y-2">
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Sync complete — {state.inserted.toLocaleString()} inserted,{" "}
              {state.updated.toLocaleString()} updated.
              {state.errors.length > 0 && (
                <> {state.errors.length} listing{state.errors.length > 1 ? "s" : ""} skipped.</>
              )}
            </span>
          </div>
          {state.errors.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-800 mb-2">
                Skipped — map these eBay categories in Admin → Categories:
              </p>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {state.errors.map((e, i) => (
                  <div key={i} className="text-xs text-amber-700">
                    <span className="font-medium">{e.title}</span>
                    <br />
                    <span className="text-amber-600">{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {state.status === "error" && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{state.message}</span>
        </div>
      )}

      <Button
        onClick={handleSync}
        disabled={disabled || busy}
        loading={busy}
        variant="outline"
      >
        <RefreshCw className="h-4 w-4" />
        {busy ? "Syncing…" : "Sync eBay Listings"}
      </Button>

      {disabled && (
        <p className="text-xs text-gray-400">Connect your eBay account above to enable listing sync.</p>
      )}
    </div>
  );
}
