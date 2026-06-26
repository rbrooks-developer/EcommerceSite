"use client";

import { useState } from "react";
import { submitOffer } from "@/lib/actions/offers";

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--checkout-input-bg, color-mix(in srgb, var(--site-fg) 8%, var(--site-bg)))",
  color: "var(--site-fg)",
  border: "1px solid color-mix(in srgb, var(--site-fg) 25%, transparent)",
};

interface Props {
  productId: string;
  listPrice: number;
  maxQuantity: number;
  existingStatus: string | null;
  existingDeclineReason: string | null;
}

export function MakeOfferForm({ productId, listPrice, maxQuantity, existingStatus, existingDeclineReason }: Props) {
  const [open, setOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (existingStatus === "pending") {
    return (
      <p className="text-sm rounded-md px-4 py-3" style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)", opacity: 0.75 }}>
        Your offer is pending review. Check <a href="/account" className="underline">My Offers</a> for updates.
      </p>
    );
  }

  if (existingStatus === "approved") {
    return (
      <p className="text-sm rounded-md px-4 py-3" style={{ backgroundColor: "color-mix(in srgb, #22c55e 10%, var(--site-bg))", border: "1px solid #86efac" }}>
        Your offer was approved! Go to <a href="/account" className="underline font-semibold">My Offers</a> to purchase.
      </p>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(offerPrice);
    if (isNaN(price) || price <= 0) return setResult({ type: "error", text: "Enter a valid offer price" });
    if (price >= listPrice) return setResult({ type: "error", text: "Offer must be less than the list price" });

    setLoading(true);
    setResult(null);
    const res = await submitOffer(productId, quantity, price);
    setLoading(false);

    if (res.error) {
      setResult({ type: "error", text: res.error });
    } else {
      setResult({ type: "success", text: "Your offer has been submitted! We'll email you once it's reviewed." });
      setOpen(false);
      setOfferPrice("");
      setQuantity(1);
    }
  }

  return (
    <div className="space-y-3">
      {existingStatus === "declined" && (
        <div className="text-sm rounded-md px-4 py-3 space-y-1" style={{ backgroundColor: "color-mix(in srgb, #ef4444 10%, var(--site-bg))", border: "1px solid #fca5a5" }}>
          <p className="font-semibold">Your previous offer was declined.</p>
          {existingDeclineReason && (
            <p style={{ opacity: 0.8 }}>Reason: {existingDeclineReason}</p>
          )}
          <p style={{ opacity: 0.7 }}>You're welcome to submit a new offer below.</p>
        </div>
      )}

      {!open && !result && (
        <button
          onClick={() => setOpen(true)}
          className="w-full rounded-md py-3 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 40%, transparent)", color: "var(--site-fg)" }}
        >
          Make an Offer
        </button>
      )}

      {result && (
        <p
          className="text-sm rounded-md px-4 py-3"
          style={{
            backgroundColor: result.type === "success"
              ? "color-mix(in srgb, #22c55e 12%, var(--site-bg))"
              : "color-mix(in srgb, #ef4444 12%, var(--site-bg))",
            border: `1px solid ${result.type === "success" ? "#86efac" : "#fca5a5"}`,
          }}
        >
          {result.text}
        </p>
      )}

      {open && (
        <form onSubmit={handleSubmit} className="rounded-lg p-5 space-y-4"
          style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)", backgroundColor: "var(--checkout-section-bg, color-mix(in srgb, var(--site-fg) 5%, var(--site-bg)))" }}>
          <h3 className="font-semibold text-sm">Make an Offer</h3>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.65 }}>
              Your offer price per unit (list price: ${listPrice.toFixed(2)})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ opacity: 0.6 }}>$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={listPrice - 0.01}
                value={offerPrice}
                onChange={e => setOfferPrice(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-md pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-current"
                style={inputStyle}
              />
            </div>
          </div>

          {maxQuantity > 1 && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.65 }}>
                Quantity (max {maxQuantity})
              </label>
              <input
                type="number"
                min="1"
                max={maxQuantity}
                value={quantity}
                onChange={e => setQuantity(Math.max(1, Math.min(maxQuantity, parseInt(e.target.value) || 1)))}
                className="w-full rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-current"
                style={inputStyle}
              />
            </div>
          )}

          {result?.type === "error" && (
            <p className="text-xs text-red-400">{result.text}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-md py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)" }}
            >
              {loading ? "Submitting…" : "Submit Offer"}
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); setResult(null); }}
              className="rounded-md px-4 py-2.5 text-sm transition-opacity hover:opacity-60"
              style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 30%, transparent)" }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
