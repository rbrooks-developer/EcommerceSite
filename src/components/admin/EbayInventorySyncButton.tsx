"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";

type SyncState =
  | { status: "idle" }
  | { status: "syncing"; current: number; total: number; updated: number; zeroed: number; unchanged: number; lastTitle: string }
  | { status: "done"; total: number; updated: number; zeroed: number; unchanged: number; errors: number }
  | { status: "error"; message: string };

export function EbayInventorySyncButton({ disabled }: { disabled?: boolean }) {
  const [state, setState] = useState<SyncState>({ status: "idle" });

  async function handleSync() {
    setState({ status: "syncing", current: 0, total: 0, updated: 0, zeroed: 0, unchanged: 0, lastTitle: "" });
    try {
      const res = await fetch("/api/ebay/inventory/sync", { method: "POST" });
      if (!res.body) throw new Error("No response body");

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let   buffer  = "";
      let   total = 0, updated = 0, zeroed = 0, unchanged = 0;

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
            if (msg.type === "total") {
              total = msg.count;
              setState({ status: "syncing", current: 0, total, updated: 0, zeroed: 0, unchanged: 0, lastTitle: "" });
            } else if (msg.type === "item") {
              if (msg.status === "updated")   updated++;
              if (msg.status === "zeroed")    zeroed++;
              if (msg.status === "unchanged") unchanged++;
              setState({ status: "syncing", current: msg.current, total, updated, zeroed, unchanged, lastTitle: msg.title });
            } else if (msg.type === "done") {
              setState({ status: "done", total: msg.total, updated: msg.updated, zeroed: msg.zeroed, unchanged: msg.unchanged, errors: msg.errors ?? 0 });
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

  return (
    <div className="space-y-3">
      {state.status === "syncing" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm text-blue-800">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Checking {state.current} of {state.total}
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
            <span>{state.updated} updated</span>
            <span>{state.zeroed} zeroed out</span>
            <span>{state.unchanged} unchanged</span>
          </div>

          {state.lastTitle && (
            <p className="text-xs text-blue-600 truncate">{state.lastTitle}</p>
          )}
        </div>
      )}

      {state.status === "done" && (
        <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Sync complete — {state.total} checked, {state.updated} updated,{" "}
            {state.zeroed} zeroed out, {state.unchanged} unchanged
            {state.errors > 0 && `, ${state.errors} errors`}.
          </span>
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
        disabled={disabled || state.status === "syncing"}
        loading={state.status === "syncing"}
        variant="outline"
      >
        <RefreshCw className="h-4 w-4" />
        {state.status === "syncing" ? "Syncing…" : "Sync Now"}
      </Button>

      {disabled && (
        <p className="text-xs text-gray-400">Connect your eBay account above to enable inventory sync.</p>
      )}
    </div>
  );
}
