"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart/store";
import { addOfferToCart, acceptCounter, declineCounter, userCounterBack } from "@/lib/actions/offers";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatPrice } from "@/lib/utils";

type OfferRow = {
  id: string;
  product_id: string;
  quantity: number;
  offer_price: number;
  counter_price: number | null;
  user_counter_count: number;
  status: string;
  decline_reason: string | null;
  expires_at: string | null;
  created_at: string;
  products: {
    name: string;
    slug: string;
    images: string[];
    weight_oz: number;
    length_in: number;
    width_in: number;
    height_in: number;
    price: number;
  } | null;
};

const MAX_OFFERS = 4;

type CardHandlers = {
  busy: string | null;
  counterInputs: Record<string, string>;
  counterErrors: Record<string, string>;
  setCounterInput: (id: string, val: string) => void;
  onAddToCart: (offer: OfferRow) => void;
  onAccept: (offerId: string) => void;
  onDecline: (offerId: string) => void;
  onUserCounter: (offer: OfferRow, price: string) => void;
  offersUsedByProduct: Record<string, number>;
};

function daysLeft(expiresAt: string): number {
  const diff = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function StatusBadge({ status, expiresAt }: { status: string; expiresAt: string | null }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    pending:      { label: "Pending Review", bg: "#fef9c3", color: "#854d0e" },
    approved:     { label: "Approved",       bg: "#dcfce7", color: "#166534" },
    declined:     { label: "Declined",       bg: "#fee2e2", color: "#991b1b" },
    purchased:    { label: "Purchased",      bg: "#e0e7ff", color: "#3730a3" },
    expired:      { label: "Expired",        bg: "#f3f4f6", color: "#6b7280" },
    out_of_stock: { label: "Out of Stock",   bg: "#fff7ed", color: "#9a3412" },
    countered:    { label: "Counter Offer",  bg: "#eff6ff", color: "#1d4ed8" },
  };
  const s = map[status] ?? { label: status, bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span className="text-xs font-semibold rounded-full px-2.5 py-0.5" style={{ backgroundColor: s.bg, color: s.color, WebkitTextFillColor: s.color }}>
      {status === "approved" && expiresAt ? `Approved · ${daysLeft(expiresAt)}d left` : s.label}
    </span>
  );
}

function OfferCard({ offer, handlers }: { offer: OfferRow; handlers: CardHandlers }) {
  const { busy, counterInputs, counterErrors, setCounterInput, onAddToCart, onAccept, onDecline, onUserCounter, offersUsedByProduct } = handlers;
  const offersUsed = offersUsedByProduct[offer.product_id] ?? 0;
  const offersRemaining = Math.max(0, MAX_OFFERS - offersUsed);
  const remainingLabel = offersRemaining === 1 ? "1 offer remaining" : `${offersRemaining} offers remaining`;

  const isApproved  = offer.status === "approved" && offer.expires_at && daysLeft(offer.expires_at) > 0;
  const isCountered = offer.status === "countered";

  return (
    <div className="rounded-lg p-4 space-y-3"
      style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)", backgroundColor: "var(--checkout-section-bg, color-mix(in srgb, var(--site-fg) 5%, var(--site-bg)))" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {offer.products?.slug ? (
            <Link href={`/products/${offer.products.slug}`} className="font-medium text-sm hover:underline line-clamp-2">
              {offer.products.name}
            </Link>
          ) : (
            <p className="font-medium text-sm">{offer.products?.name ?? "Product"}</p>
          )}
          <p className="text-xs mt-0.5" style={{ opacity: 0.5 }}>
            {offer.quantity} × {formatPrice(offer.offer_price * 100)} = {formatPrice(offer.offer_price * offer.quantity * 100)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={offer.status} expiresAt={offer.expires_at} />
        </div>
      </div>

      {offer.status === "declined" && offer.decline_reason && (
        <p className="text-xs rounded px-3 py-2" style={{ backgroundColor: "color-mix(in srgb, #ef4444 10%, var(--site-bg))", opacity: 0.85 }}>
          Reason: {offer.decline_reason}
        </p>
      )}

      {isCountered && offer.counter_price && (
        <div className="space-y-3 rounded-md p-3" style={{ backgroundColor: "color-mix(in srgb, #3b82f6 8%, var(--site-bg))", border: "1px solid color-mix(in srgb, #3b82f6 25%, transparent)" }}>
          <div className="flex justify-between items-center text-sm">
            <span style={{ opacity: 0.7 }}>Counter offer received</span>
            <span className="font-semibold" style={{ color: "#1d4ed8", WebkitTextFillColor: "#1d4ed8" }}>
              {formatPrice(offer.counter_price * 100)} ea
            </span>
          </div>
          <p className="text-xs" style={{ opacity: 0.6 }}>
            Total: {formatPrice(offer.counter_price * offer.quantity * 100)} for {offer.quantity} unit{offer.quantity !== 1 ? "s" : ""}
          </p>

          <div className="flex gap-2">
            <button
              onClick={() => onAccept(offer.id)}
              disabled={!!busy}
              className="flex-1 rounded-md py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)", WebkitTextFillColor: "var(--site-bg)" }}
            >
              {busy === offer.id + ":accept" ? "Accepting…" : "Accept"}
            </button>
            <button
              onClick={() => onDecline(offer.id)}
              disabled={!!busy}
              className="flex-1 rounded-md py-2 text-xs font-semibold border transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ borderColor: "color-mix(in srgb, var(--site-fg) 25%, transparent)" }}
            >
              {busy === offer.id + ":decline" ? "Declining…" : "Decline"}
            </button>
          </div>

          <div className="space-y-1.5 pt-1 border-t" style={{ borderColor: "color-mix(in srgb, #3b82f6 20%, transparent)" }}>
            {offersRemaining === 0 ? (
              <p className="text-xs" style={{ opacity: 0.5 }}>You've used all {MAX_OFFERS} offer slots for this product — you can only accept or decline.</p>
            ) : (<>
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ opacity: 0.6 }}>Or send your own counter price <span className="font-semibold" style={{ opacity: 1 }}>per item</span>:</p>
              <p className="text-xs" style={{ opacity: 0.5 }}>{remainingLabel} for this product</p>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ opacity: 0.5 }}>$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={counterInputs[offer.id] ?? ""}
                  onChange={e => {
                    const val = e.target.value;
                    if (/^\d*\.?\d{0,2}$/.test(val)) setCounterInput(offer.id, val);
                  }}
                  placeholder="0.00"
                  className="w-full rounded-md pl-6 pr-3 py-2 text-xs focus:outline-none"
                  style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 25%, transparent)", backgroundColor: "var(--site-bg)" }}
                />
              </div>
              <button
                onClick={() => onUserCounter(offer, counterInputs[offer.id] ?? "")}
                disabled={!!busy}
                className="rounded-md px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)", WebkitTextFillColor: "var(--site-bg)" }}
              >
                {busy === offer.id + ":counter" ? "Sending…" : "Counter"}
              </button>
            </div>
            {(() => {
              const p = parseFloat(counterInputs[offer.id] ?? "");
              if (!isNaN(p) && p > 0 && offer.quantity > 1) {
                return (
                  <p className="text-xs" style={{ opacity: 0.6 }}>
                    Total: <span className="font-semibold">{formatPrice(p * offer.quantity * 100)}</span>
                    <span style={{ opacity: 0.7 }}> ({offer.quantity} × {formatPrice(p * 100)})</span>
                  </p>
                );
              }
              return null;
            })()}
            {counterErrors[offer.id] && (
              <p className="text-xs" style={{ color: "#ef4444", WebkitTextFillColor: "#ef4444" }}>{counterErrors[offer.id]}</p>
            )}
            </>)}
          </div>
        </div>
      )}

      {isApproved && (
        <button
          onClick={() => onAddToCart(offer)}
          disabled={!!busy}
          className="w-full rounded-md py-2.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
          style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)", fontFamily: "inherit" }}
        >
          {busy === offer.id ? "Adding…" : "Add to Cart"}
        </button>
      )}
    </div>
  );
}

export function MyOffers({ offers }: { offers: OfferRow[] }) {
  const { reloadCart } = useCart();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [counterInputs, setCounterInputs] = useState<Record<string, string>>({});
  const [counterErrors, setCounterErrors] = useState<Record<string, string>>({});

  if (offers.length === 0) {
    return <p className="text-sm" style={{ opacity: 0.45 }}>You haven't made any offers yet.</p>;
  }

  function setCounterInput(id: string, val: string) {
    setCounterInputs(prev => ({ ...prev, [id]: val }));
  }

  async function handleAddToCart(offer: OfferRow) {
    setBusy(offer.id);
    const result = await addOfferToCart(offer.id);
    if (!result.ok) { setBusy(null); router.refresh(); return; }
    await reloadCart();
    setBusy(null);
    router.push("/cart");
  }

  async function handleAcceptCounter(offerId: string) {
    setBusy(offerId + ":accept");
    try {
      const accepted = await acceptCounter(offerId) as any;
      if (accepted?.error) { setBusy(null); router.refresh(); return; }
      const added = await addOfferToCart(offerId);
      if (added.ok) {
        await reloadCart();
        setBusy(null);
        router.push("/cart");
        return;
      }
    } catch (err: any) {
      console.error("acceptCounter:", err?.message);
    }
    setBusy(null);
    router.refresh();
  }

  async function handleDeclineCounter(offerId: string) {
    setBusy(offerId + ":decline");
    try {
      await declineCounter(offerId);
    } catch (err: any) {
      console.error("declineCounter:", err?.message);
    }
    setBusy(null);
    router.refresh();
  }

  async function handleUserCounter(offer: OfferRow, rawPrice: string) {
    const price = parseFloat(rawPrice);
    if (!price || price <= 0) {
      setCounterErrors(e => ({ ...e, [offer.id]: "Enter a valid price." }));
      return;
    }
    const listPrice = Number(offer.products?.price ?? 0);
    if (listPrice > 0 && price >= listPrice) {
      setCounterErrors(e => ({ ...e, [offer.id]: `Must be less than list price (${formatPrice(listPrice * 100)}).` }));
      return;
    }
    setBusy(offer.id + ":counter");
    setCounterErrors(e => ({ ...e, [offer.id]: "" }));
    try {
      const result = await userCounterBack(offer.id, price) as any;
      if (result?.error) {
        setCounterErrors(e => ({ ...e, [offer.id]: result.error }));
        setBusy(null);
        return;
      }
    } catch (err: any) {
      setCounterErrors(e => ({ ...e, [offer.id]: err?.message ?? "Something went wrong. Please try again." }));
      setBusy(null);
      return;
    }
    setBusy(null);
    router.refresh();
  }

  const offersUsedByProduct: Record<string, number> = {};
  for (const o of offers) {
    if (["pending", "approved", "declined", "purchased", "out_of_stock", "countered"].includes(o.status)) {
      offersUsedByProduct[o.product_id] =
        (offersUsedByProduct[o.product_id] ?? 0) + 1 + (o.user_counter_count ?? 0);
    }
  }

  const handlers: CardHandlers = {
    busy,
    counterInputs,
    counterErrors,
    setCounterInput,
    onAddToCart: handleAddToCart,
    onAccept: handleAcceptCounter,
    onDecline: handleDeclineCounter,
    onUserCounter: handleUserCounter,
    offersUsedByProduct,
  };

  const active  = offers.filter(o => ["pending", "approved", "countered"].includes(o.status));
  const history = offers.filter(o => ["declined", "purchased", "expired", "out_of_stock"].includes(o.status));

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map(o => <OfferCard key={o.id} offer={o} handlers={handlers} />)}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ opacity: 0.45 }}>History</p>
          {history.map(o => <OfferCard key={o.id} offer={o} handlers={handlers} />)}
        </div>
      )}
    </div>
  );
}
