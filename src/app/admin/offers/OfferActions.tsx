"use client";

import { useState } from "react";
import { approveOffer, declineOffer, counterOffer } from "@/lib/actions/offers";
import { useRouter } from "next/navigation";

export function OfferActions({ offerId, listPrice, quantity = 1 }: { offerId: string; listPrice: number; quantity?: number }) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "declining" | "countering">("idle");
  const [reason, setReason] = useState("");
  const [counterPrice, setCounterPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleApprove() {
    setBusy(true);
    await approveOffer(offerId);
    router.refresh();
  }

  async function handleDecline() {
    setBusy(true);
    await declineOffer(offerId, reason.trim() || undefined);
    router.refresh();
  }

  async function handleCounter() {
    const price = parseFloat(counterPrice);
    if (!price || price <= 0) { setErr("Enter a valid price."); return; }
    if (listPrice > 0 && price >= listPrice) { setErr(`Must be less than list price (${listPrice.toFixed(2)}).`); return; }
    setBusy(true);
    setErr(null);
    const result = await counterOffer(offerId, price) as any;
    if (result?.error) { setErr(result.error); setBusy(false); return; }
    router.refresh();
  }

  if (mode === "declining") {
    return (
      <div className="space-y-2 min-w-[200px]">
        <textarea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason (optional)"
          rows={2}
          className="w-full rounded border border-gray-300 px-3 py-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
        />
        <div className="flex gap-2">
          <button onClick={handleDecline} disabled={busy} className="flex-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
            {busy ? "…" : "Confirm Decline"}
          </button>
          <button onClick={() => setMode("idle")} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "countering") {
    const parsedPrice = parseFloat(counterPrice);
    const total = !isNaN(parsedPrice) && parsedPrice > 0 ? parsedPrice * quantity : null;
    return (
      <div className="space-y-2 min-w-[200px]">
        <p className="text-xs font-medium text-gray-500">Counter price <span className="text-gray-900 font-semibold">per item</span></p>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={counterPrice}
            onChange={e => {
              const val = e.target.value;
              if (/^\d*\.?\d{0,2}$/.test(val)) { setCounterPrice(val); setErr(null); }
            }}
            placeholder="0.00"
            className="w-full rounded border border-gray-300 pl-6 pr-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {total !== null && (
          <p className="text-xs text-gray-500">
            Total: <span className="font-semibold text-gray-800">${total.toFixed(2)}</span>
            <span className="text-gray-400"> ({quantity} × ${parsedPrice.toFixed(2)})</span>
          </p>
        )}
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button onClick={handleCounter} disabled={busy} className="flex-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {busy ? "…" : "Send Counter"}
          </button>
          <button onClick={() => { setMode("idle"); setErr(null); }} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap">
      <button onClick={handleApprove} disabled={busy} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors">
        Approve
      </button>
      <button onClick={() => setMode("countering")} disabled={busy} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
        Counter
      </button>
      <button onClick={() => setMode("declining")} disabled={busy} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
        Decline
      </button>
    </div>
  );
}
