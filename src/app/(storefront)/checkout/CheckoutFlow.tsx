"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements, ExpressCheckoutElement, PaymentElement,
  useStripe, useElements,
} from "@stripe/react-stripe-js";
import { useCart } from "@/lib/cart/store";
import { validateAndSyncCart } from "@/lib/actions/cart";
import { applyPromoCode, removePromoCode } from "@/lib/actions/promos";
import type { AppliedPromo } from "@/lib/actions/promos";
import { calculatePromoDiscount } from "@/lib/promos/calculate";
import { formatPrice } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { X, Lock, ShieldCheck, Tag, Check, Pencil } from "lucide-react";
import { SUBDIVISIONS, getSubdivisionLabel } from "@/lib/data/countries";
import type { Country } from "@/lib/data/countries";
import type { EasyPostRate, ShippingAddress, UserAddress, CheckoutConfig, SurchargeConfig } from "@/types";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const stripeAppearance = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#18181b",
    colorBackground: "#ffffff",
    colorText: "#18181b",
    colorDanger: "#dc2626",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif",
    spacingUnit: "4px",
    borderRadius: "8px",
    fontSizeBase: "14px",
  },
  rules: {
    ".Input": { border: "1.5px solid #e5e7eb", boxShadow: "none", padding: "10px 14px" },
    ".Input:hover": { borderColor: "#d1d5db" },
    ".Input:focus": { border: "1.5px solid #18181b", boxShadow: "0 0 0 2px rgba(24,24,27,0.08)", outline: "none" },
    ".Input--invalid": { border: "1.5px solid #dc2626" },
    ".Label": { fontWeight: "500", color: "#374151", marginBottom: "6px" },
    ".Block": { border: "1.5px solid #e5e7eb" },
  },
};

// ── Style constants ────────────────────────────────────────────────────────────

const fg = "var(--site-fg)";
const bg = "var(--site-bg)";
const mix = (p: number) => `color-mix(in srgb, ${fg} ${p}%, ${bg})`;
const mixT = (p: number) => `color-mix(in srgb, ${fg} ${p}%, transparent)`;

const inputStyle: React.CSSProperties = { backgroundColor: mix(5), color: fg, border: `1px solid ${mixT(18)}` };
const inputErrStyle: React.CSSProperties = { ...inputStyle, border: "1px solid rgb(248 113 113)" };
const btnPrimary: React.CSSProperties = { backgroundColor: fg, color: bg };
const cardStyle: React.CSSProperties = {
  backgroundColor: mix(4),
  border: `1px solid ${mixT(12)}`,
  borderRadius: "14px",
  position: "relative",
  zIndex: 46,
};
const rowStyle: React.CSSProperties = { backgroundColor: mix(6), border: `1px solid ${mixT(10)}`, borderRadius: "10px" };
const divider = `1px solid ${mixT(10)}`;
const inputCls = "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-current transition-colors";
const EMPTY: ShippingAddress = { name: "", address_line1: "", address_line2: "", city: "", state: "", zip: "", country: "US" };

// ── Section wrapper ────────────────────────────────────────────────────────────
// state: "open" | "locked" | "collapsed"
// locked = completed step, shows summary + edit button
// collapsed = not yet reachable, shown dimly with no content

type SectionState = "open" | "locked" | "collapsed";

function Section({
  num, title, state, summary, onEdit, children,
}: {
  num: number;
  title: string;
  state: SectionState;
  summary?: React.ReactNode;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  const isCollapsed = state === "collapsed";
  const isLocked = state === "locked";
  const isOpen = state === "open";

  return (
    <div style={{ ...cardStyle, opacity: isCollapsed ? 0.45 : 1 }} className="overflow-hidden transition-opacity">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
            style={{ backgroundColor: isLocked ? fg : isOpen ? fg : mix(20), color: bg }}
          >
            {isLocked ? <Check className="h-3.5 w-3.5" /> : num}
          </div>
          <span className="font-bold text-sm">{title}</span>
          {isLocked && summary && (
            <span className="text-xs truncate ml-1" style={{ opacity: 0.5 }}>{summary}</span>
          )}
        </div>
        {isLocked && onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs font-medium shrink-0 ml-3 transition-opacity hover:opacity-100"
            style={{ opacity: 0.45 }}
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>

      {isOpen && children && (
        <div className="px-5 pb-5 pt-4 space-y-4" style={{ borderTop: divider }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── Address fields component ───────────────────────────────────────────────────

function AddressFields({
  value, onChange, errors, allowedCountries, showName = true,
}: {
  value: ShippingAddress;
  onChange: (a: ShippingAddress) => void;
  errors: Partial<Record<keyof ShippingAddress, string>>;
  allowedCountries: Country[];
  showName?: boolean;
}) {
  const subdivisions = SUBDIVISIONS[value.country] ?? [];
  const hasSubdivisions = subdivisions.length > 0;

  return (
    <div className="space-y-3">
      {showName && (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.55 }}>Full Name</label>
          <input value={value.name} onChange={e => onChange({ ...value, name: e.target.value })}
            placeholder="Jane Smith" autoComplete="name" className={inputCls}
            style={errors.name ? inputErrStyle : inputStyle} />
          {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
        </div>
      )}
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.55 }}>Country</label>
        <select value={value.country} onChange={e => onChange({ ...value, country: e.target.value, state: "" })}
          className={inputCls} style={inputStyle}>
          {allowedCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.55 }}>Street Address</label>
        <input value={value.address_line1} onChange={e => onChange({ ...value, address_line1: e.target.value })}
          placeholder="123 Main St" autoComplete="address-line1" className={inputCls}
          style={errors.address_line1 ? inputErrStyle : inputStyle} />
        {errors.address_line1 && <p className="mt-1 text-xs text-red-400">{errors.address_line1}</p>}
      </div>
      <div>
        <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.55 }}>
          Apt, Suite, etc. <span style={{ opacity: 0.5 }}>(optional)</span>
        </label>
        <input value={value.address_line2 ?? ""} onChange={e => onChange({ ...value, address_line2: e.target.value })}
          autoComplete="address-line2" className={inputCls} style={inputStyle} />
      </div>
      <div className={`grid gap-3 ${hasSubdivisions ? "grid-cols-3" : "grid-cols-2"}`}>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.55 }}>City</label>
          <input value={value.city} onChange={e => onChange({ ...value, city: e.target.value })}
            autoComplete="address-level2" className={inputCls}
            style={errors.city ? inputErrStyle : inputStyle} />
          {errors.city && <p className="mt-1 text-xs text-red-400">{errors.city}</p>}
        </div>
        {hasSubdivisions && (
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.55 }}>{getSubdivisionLabel(value.country)}</label>
            <select value={value.state} onChange={e => onChange({ ...value, state: e.target.value })}
              className={inputCls} style={errors.state ? inputErrStyle : inputStyle}>
              <option value="">Select…</option>
              {subdivisions.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
            </select>
            {errors.state && <p className="mt-1 text-xs text-red-400">{errors.state}</p>}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.55 }}>
            {value.country === "GB" ? "Postcode" : "ZIP Code"}
          </label>
          <input value={value.zip} onChange={e => onChange({ ...value, zip: e.target.value })}
            autoComplete="postal-code" className={inputCls}
            style={errors.zip ? inputErrStyle : inputStyle} />
          {errors.zip && <p className="mt-1 text-xs text-red-400">{errors.zip}</p>}
        </div>
      </div>
    </div>
  );
}

// ── PaymentForm (must live inside <Elements>) ──────────────────────────────────

interface PaymentFormProps {
  clientSecret: string;
  orderId: string;
  baseTotal: number;
  displayTotal: number;
  surchargeConfig?: SurchargeConfig | null;
  billingAddress: ShippingAddress;
  onPaymentTypeChange: (t: string) => void;
  onSurchargeApplied: (s: { amount: number; percent: number } | null) => void;
}

function PaymentForm({
  clientSecret, orderId, baseTotal, displayTotal, surchargeConfig,
  billingAddress, onPaymentTypeChange, onSurchargeApplied,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surcharge, setSurcharge] = useState<{ amount: number; percent: number } | null>(null);
  const [hasExpress, setHasExpress] = useState(false);
  const [selectedType, setSelectedType] = useState("card");
  const isRedirect = selectedType === "klarna" || selectedType === "amazon_pay";

  function handleTypeChange(type: string) {
    setSelectedType(type);
    onPaymentTypeChange(type);
    if (type !== "card" && surcharge) { setSurcharge(null); onSurchargeApplied(null); }
  }

  async function handleExpressConfirm() {
    if (!stripe || !elements) return;
    const { error: err } = await stripe.confirmPayment({
      elements, clientSecret,
      confirmParams: { return_url: `${window.location.origin}/checkout/success` },
    });
    if (err) setError(err.message ?? "Payment failed.");
  }

  async function handlePay() {
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) { setError(submitErr.message ?? "Please check your payment details."); setLoading(false); return; }

    if (isRedirect) {
      const { error: err } = await stripe.confirmPayment({
        elements, clientSecret,
        confirmParams: { return_url: `${window.location.origin}/checkout/success` },
      });
      if (err) { setError(err.message ?? "Payment failed."); setLoading(false); }
      return;
    }

    const { paymentMethod, error: pmErr } = await stripe.createPaymentMethod({ elements });
    if (pmErr || !paymentMethod) { setError(pmErr?.message ?? "Unable to process payment."); setLoading(false); return; }

    if (paymentMethod.card?.funding === "credit" && surchargeConfig?.surcharge_active) {
      const intentId = clientSecret.split("_secret_")[0];
      const res = await fetch("/api/checkout/update-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId, orderId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to update payment."); setLoading(false); return; }
      if ((data.surchargeAmount ?? 0) > 0) {
        const s = { amount: data.surchargeAmount, percent: data.surchargePercentage };
        setSurcharge(s);
        onSurchargeApplied(s);
      }
    }

    const { error: confirmErr } = await stripe.confirmPayment({
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
        payment_method: paymentMethod.id,
      },
    });
    if (confirmErr) { setError(confirmErr.message ?? "Payment failed."); setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        onReady={e => setHasExpress(!!(e as any).availablePaymentMethods)}
        onConfirm={handleExpressConfirm}
        options={{
          buttonHeight: 50,
          paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", klarna: "never", amazonPay: "never", paypal: "never" },
        }}
      />
      {hasExpress && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: mixT(12) }} />
          <span className="text-xs uppercase tracking-widest" style={{ opacity: 0.35 }}>or pay with</span>
          <div className="flex-1 h-px" style={{ backgroundColor: mixT(12) }} />
        </div>
      )}
      <PaymentElement
        onChange={e => handleTypeChange(e.value.type)}
        options={{
          layout: { type: "accordion", defaultCollapsed: false },
          fields: { billingDetails: { name: "never", address: "never" } },
          defaultValues: {
            billingDetails: {
              name: billingAddress.name,
              address: {
                line1: billingAddress.address_line1,
                line2: billingAddress.address_line2 ?? "",
                city: billingAddress.city,
                state: billingAddress.state,
                postal_code: billingAddress.zip,
                country: billingAddress.country,
              },
            },
          },
        }}
      />
      {surchargeConfig?.surcharge_active && surchargeConfig.surcharge_message && !surcharge && selectedType === "card" && (
        <p className="text-xs px-1" style={{ opacity: 0.45 }}>{surchargeConfig.surcharge_message}</p>
      )}
      {surcharge && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <p className="text-green-700 dark:text-green-400">
            A {surcharge.percent}% credit card surcharge of {formatPrice(surcharge.amount * 100)} has been applied.
          </p>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-400 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </p>
      )}
      <button
        onClick={handlePay}
        disabled={!stripe || !elements || loading}
        className="w-full rounded-xl py-4 text-sm font-bold tracking-wide transition-opacity hover:opacity-85 disabled:opacity-40 flex items-center justify-center gap-2"
        style={btnPrimary}
      >
        {loading
          ? <><Spinner className="h-4 w-4" /> Processing…</>
          : isRedirect
            ? <>Continue with {selectedType === "klarna" ? "Klarna" : "Amazon Pay"} →</>
            : <><Lock className="h-3.5 w-3.5" /> Pay {formatPrice(Math.round(displayTotal * 100))}</>
        }
      </button>
      <div className="flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" style={{ opacity: 0.28 }} />
        <span className="text-xs" style={{ opacity: 0.28 }}>Payments secured by Stripe</span>
      </div>
    </div>
  );
}

// ── Main checkout ──────────────────────────────────────────────────────────────

// phase drives which sections are open/locked/collapsed
type Phase = "address" | "billing" | "payment";

export function CheckoutFlow({
  allowedCountries,
  defaultShipping,
  defaultBilling,
  initialPromo,
  checkoutConfig,
  surchargeConfig,
}: {
  allowedCountries: Country[];
  defaultShipping: UserAddress | null;
  defaultBilling: UserAddress | null;
  initialPromo?: AppliedPromo | null;
  checkoutConfig?: CheckoutConfig | null;
  surchargeConfig?: SurchargeConfig | null;
}) {
  const { items, subtotal, reloadCart } = useCart();
  const defaultCountry = allowedCountries[0]?.code ?? "US";

  const fromUserAddr = (u: UserAddress | null): ShippingAddress => u ? {
    name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
    address_line1: u.address_line1 ?? "",
    address_line2: u.address_line2 ?? "",
    city: u.city ?? "",
    state: u.state ?? "",
    zip: u.zip ?? "",
    country: u.country ?? defaultCountry,
  } : { ...EMPTY, country: defaultCountry };

  // ── State ────────────────────────────────────────────────────────────────────

  const [phase, setPhase] = useState<Phase>("address");
  const [shippingEditOpen, setShippingEditOpen] = useState(false);

  // Section 1 — Shipping Address
  const [address, setAddress] = useState<ShippingAddress>(fromUserAddr(defaultShipping));
  const [addrErrors, setAddrErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});
  const [addrLoading, setAddrLoading] = useState(false);
  const [addrError, setAddrError] = useState<string | null>(null);

  // Section 2 — Billing Address
  const [sameAsShipping, setSameAsShipping] = useState(!defaultBilling);
  const [billingAddress, setBillingAddress] = useState<ShippingAddress>(
    defaultBilling ? fromUserAddr(defaultBilling) : fromUserAddr(defaultShipping)
  );
  const [billErrors, setBillErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});
  const [billLoading, setBillLoading] = useState(false);
  const [billError, setBillError] = useState<string | null>(null);

  // Address used for the last successful rate fetch (to skip re-calc when nothing changed)
  const [ratesForAddress, setRatesForAddress] = useState<ShippingAddress | null>(null);

  // Section 3 — Shipping Method
  const [rates, setRates] = useState<EasyPostRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<EasyPostRate | null>(null);
  const [insuranceFee, setInsuranceFee] = useState(0);
  const [insuranceRequired, setInsuranceRequired] = useState(false);
  const [signatureRequired, setSignatureRequired] = useState(false);

  // Section 4 — Payment
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderIdForPayment, setOrderIdForPayment] = useState<string | null>(null);
  const [baseTotal, setBaseTotal] = useState(0);
  const [selectedPaymentType, setSelectedPaymentType] = useState("card");
  const [actualSurcharge, setActualSurcharge] = useState<{ amount: number; percent: number } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Promo
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(initialPromo ?? null);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // ── Derived totals ───────────────────────────────────────────────────────────

  const shippingCost = selectedRate ? parseFloat(selectedRate.rate) : 0;
  const d = appliedPromo ? calculatePromoDiscount(appliedPromo, subtotal, shippingCost, address.country) : null;
  const discountAmount = d?.discountAmount ?? 0;
  const rawBaseShipping = selectedRate ? parseFloat(selectedRate.rate) - insuranceFee : 0;
  const shippingDiscount = d?.shippingDiscount ?? 0;
  const displayBaseShipping = Math.max(0, rawBaseShipping - shippingDiscount);
  const shippingDiscountApplied = rawBaseShipping - displayBaseShipping;
  const insuranceDiscountApplied = Math.min(insuranceFee, Math.max(0, shippingDiscount - rawBaseShipping));
  const displayInsurance = Math.max(0, insuranceFee - insuranceDiscountApplied);
  const discountedSubtotal = subtotal - discountAmount;
  const effectiveTotal = discountedSubtotal + displayBaseShipping + displayInsurance;

  let estimatedSurcharge = 0;
  if (selectedPaymentType === "card" && surchargeConfig?.surcharge_active && (surchargeConfig.surcharge_percent ?? 0) > 0 && selectedRate && !actualSurcharge) {
    const minOrder = surchargeConfig.surcharge_min_order ?? 0;
    if (minOrder === 0 || effectiveTotal >= minOrder) {
      const pct = Math.min(surchargeConfig.surcharge_percent, 4);
      estimatedSurcharge = Math.round(discountedSubtotal * pct / 100 * 100) / 100;
    }
  }
  // Always derive from live effectiveTotal so promos/surcharges reflect immediately.
  // In payment phase, swap in actual surcharge once confirmed; otherwise use estimate.
  const displayedTotal = clientSecret
    ? effectiveTotal + (actualSurcharge?.amount ?? estimatedSurcharge)
    : effectiveTotal;

  const effectiveBilling: ShippingAddress = sameAsShipping ? address : billingAddress;

  // ── Section states ───────────────────────────────────────────────────────────

  const s1: SectionState = phase === "address" ? "open" : "locked";
  const s2: SectionState = phase === "address" ? "collapsed" : phase === "billing" ? "open" : "locked";
  // Section 3 locked = auto-selected rate shown with Edit link; open only when explicitly editing
  const s3: SectionState = phase === "address" ? "collapsed" : shippingEditOpen ? "open" : "locked";
  const s4: SectionState = phase === "payment" && !shippingEditOpen ? "open" : "collapsed";

  // ── Address summaries ────────────────────────────────────────────────────────

  const addrSummary = [address.address_line1, address.city, [address.state, address.zip].filter(Boolean).join(" ")]
    .filter(Boolean).join(", ");

  const billSummary = sameAsShipping ? "Same as shipping" : [
    billingAddress.address_line1,
    billingAddress.city,
    [billingAddress.state, billingAddress.zip].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  const rateSummary = selectedRate
    ? `${selectedRate.carrier} ${selectedRate.service} · ${formatPrice(parseFloat(selectedRate.rate) * 100)}`
    : "";

  // ── Validation helper ────────────────────────────────────────────────────────

  function validateAddr(a: ShippingAddress, setErrs: (e: Partial<Record<keyof ShippingAddress, string>>) => void) {
    const subs = SUBDIVISIONS[a.country] ?? [];
    const errs: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!a.name.trim()) errs.name = "Full name is required";
    if (!a.address_line1.trim()) errs.address_line1 = "Street address is required";
    if (!a.city.trim()) errs.city = "City is required";
    if (subs.length > 0 && !a.state) errs.state = `${getSubdivisionLabel(a.country)} is required`;
    if (!a.zip.trim()) errs.zip = "Postal code is required";
    setErrs(errs);
    return Object.keys(errs).length === 0;
  }

  // ── Section 1: Continue to Billing ──────────────────────────────────────────
  // Validates address, fetches shipping rates (shows error if fails), then advances.
  // Skips rate re-fetch if the shipping-relevant fields haven't changed since last fetch.

  function shippingFieldsChanged(a: ShippingAddress, b: ShippingAddress) {
    return (
      a.address_line1 !== b.address_line1 ||
      (a.address_line2 ?? "") !== (b.address_line2 ?? "") ||
      a.city !== b.city ||
      a.state !== b.state ||
      a.zip !== b.zip ||
      a.country !== b.country
    );
  }

  async function continueFromAddress() {
    if (!validateAddr(address, setAddrErrors)) return;

    // If nothing changed since the last successful rate fetch, just advance
    if (ratesForAddress && !shippingFieldsChanged(address, ratesForAddress) && rates.length > 0 && selectedRate) {
      if (sameAsShipping) setBillingAddress(address);
      setPhase("billing");
      return;
    }

    setAddrLoading(true);
    setAddrError(null);
    try {
      const { valid, issues } = await validateAndSyncCart();
      if (!valid) {
        await reloadCart();
        setAddrError(issues.map(i =>
          i.issue === "removed" ? `"${i.name}" is no longer available.` : `"${i.name}" reduced to qty ${i.newQuantity}.`
        ).join(" "));
        return;
      }
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity, offerId: i.offerId ?? null })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not calculate shipping for this address.");
      const sorted = [...(data.rates as EasyPostRate[])].sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
      if (sorted.length === 0) throw new Error("No shipping options available for this address.");
      setRates(sorted);
      setSelectedRate(sorted[0]);
      setRatesForAddress(address);
      setInsuranceRequired(!!data.insuranceRequired);
      setSignatureRequired(!!data.signatureRequired);
      setInsuranceFee(parseFloat(data.insuranceFee ?? "0"));
      if (sameAsShipping) setBillingAddress(address);
      setPhase("billing");
    } catch (err: any) {
      setAddrError(err.message);
    } finally {
      setAddrLoading(false);
    }
  }

  // ── Section 2: Continue to Payment ──────────────────────────────────────────

  async function continueFromBilling() {
    if (!sameAsShipping && !validateAddr(billingAddress, setBillErrors)) return;
    if (!selectedRate) return;
    setBillLoading(true);
    setBillError(null);
    try {
      const res = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity, offerId: i.offerId ?? null })),
          shippingAddress: address,
          shippingRate: selectedRate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to prepare payment");
      setClientSecret(data.clientSecret);
      setOrderIdForPayment(data.orderId);
      setBaseTotal(data.totalPrice);
      setActualSurcharge(null);
      setPhase("payment");
    } catch (err: any) {
      setBillError(err.message);
    } finally {
      setBillLoading(false);
    }
  }

  // ── Recreate payment intent (rate change, promo change while in payment) ────────

  async function recreatePaymentIntent(overrideRate?: EasyPostRate) {
    const rate = overrideRate ?? selectedRate;
    if (!rate) return;
    setClientSecret(null);
    setOrderIdForPayment(null);
    setBaseTotal(0);
    setActualSurcharge(null);
    setPaymentLoading(true);
    try {
      const res = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.productId, quantity: i.quantity, offerId: i.offerId ?? null })),
          shippingAddress: address,
          shippingRate: rate,
        }),
      });
      const data = await res.json();
      if (!res.ok) return;
      setClientSecret(data.clientSecret);
      setOrderIdForPayment(data.orderId);
      setBaseTotal(data.totalPrice);
    } finally {
      setPaymentLoading(false);
    }
  }

  // ── Section 3: Rate change while in payment phase ────────────────────────────

  async function handleRateChange(rate: EasyPostRate) {
    setSelectedRate(rate);
    if (phase === "payment") await recreatePaymentIntent(rate);
    setShippingEditOpen(false);
  }

  // ── Edit handlers ────────────────────────────────────────────────────────────

  function editAddress() {
    setPhase("address");
    setShippingEditOpen(false);
    setRates([]);
    setSelectedRate(null);
    setRatesForAddress(null);
    setClientSecret(null);
    setOrderIdForPayment(null);
    setBaseTotal(0);
    setActualSurcharge(null);
    setAddrError(null);
  }

  function editBilling() {
    setPhase("billing");
    setShippingEditOpen(false);
    setClientSecret(null);
    setOrderIdForPayment(null);
    setBaseTotal(0);
    setActualSurcharge(null);
    setBillError(null);
  }

  // ── Promo ────────────────────────────────────────────────────────────────────

  async function handleApplyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    const result = await applyPromoCode(promoInput.trim());
    if (!result.ok) { setPromoLoading(false); setPromoError(result.error ?? "Invalid promo code."); return; }
    if (result.promo!.discount_type === "free_shipping" && !result.promo!.allow_international && address.country !== "US") {
      await removePromoCode();
      setPromoLoading(false);
      setPromoError("This promo code is not valid for international orders.");
      return;
    }
    setAppliedPromo(result.promo!);
    setPromoInput("");
    setPromoLoading(false);
    if (phase === "payment") await recreatePaymentIntent();
  }

  async function handleRemovePromo() {
    setPromoLoading(true);
    await removePromoCode();
    setAppliedPromo(null);
    setPromoError(null);
    setPromoLoading(false);
    if (phase === "payment") await recreatePaymentIntent();
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-6" style={{ opacity: 0.5 }}>Your cart is empty.</p>
        <a href="/products" className="inline-block rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80" style={btnPrimary}>
          Browse Products
        </a>
      </div>
    );
  }

  // ── Order summary card (rendered in two places: mobile inline + desktop sidebar) ──

  const orderSummaryCard = (
    <div style={cardStyle} className="overflow-hidden">
      <div className="px-5 py-4">
        <h3 className="font-bold text-sm tracking-wide">Order Summary</h3>
      </div>

      {/* Items */}
      <div className="px-5 pb-4 space-y-3" style={{ borderTop: divider, paddingTop: "16px" }}>
        {items.map(item => (
          <div key={item.productId} className="flex gap-3 items-start">
            {item.image && (
              <div className="h-12 w-12 shrink-0 rounded-lg"
                style={{ backgroundImage: `url(${item.image})`, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: mix(8) }} />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium leading-snug" style={{ opacity: 0.85 }}>{item.name}</p>
              <p className="text-xs mt-0.5" style={{ opacity: 0.4 }}>Qty {item.quantity}</p>
            </div>
            <span className="text-xs font-semibold shrink-0 mt-0.5">{formatPrice(item.price * item.quantity * 100)}</span>
          </div>
        ))}
      </div>

      {/* Promo */}
      <div className="px-5 py-4 space-y-2" style={{ borderTop: divider }}>
        {appliedPromo ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-green-500 shrink-0" />
              <span className="text-xs font-semibold text-green-600 dark:text-green-400">{appliedPromo.code} applied</span>
            </div>
            <button onClick={handleRemovePromo} disabled={promoLoading}
              className="flex items-center gap-0.5 text-xs transition-opacity hover:opacity-100" style={{ opacity: 0.4 }}>
              <X className="h-3 w-3" /> Remove
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input type="text" value={promoInput}
                onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                onKeyDown={e => e.key === "Enter" && handleApplyPromo()}
                placeholder="Promo code"
                className="flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-current"
                style={inputStyle} />
              <button onClick={handleApplyPromo} disabled={promoLoading || !promoInput.trim()}
                className="rounded-lg px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-35 flex items-center gap-1"
                style={btnPrimary}>
                {promoLoading ? <Spinner className="h-3 w-3" /> : "Apply"}
              </button>
            </div>
            {promoError && <p className="text-xs text-red-400">{promoError}</p>}
          </div>
        )}
      </div>

      {/* Price breakdown */}
      <div className="px-5 pb-5 space-y-2" style={{ borderTop: divider, paddingTop: "16px" }}>
        <div className="flex justify-between text-sm" style={{ opacity: 0.65 }}>
          <span>Subtotal</span>
          <span>{formatPrice(subtotal * 100)}</span>
        </div>
        {d && d.discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
            <span>Promo ({appliedPromo!.code})</span>
            <span>−{formatPrice(d.discountAmount * 100)}</span>
          </div>
        )}
        {selectedRate && (
          <div className="flex justify-between text-sm" style={{ opacity: 0.65 }}>
            <span>Shipping</span>
            <span>
              {displayBaseShipping === 0 && shippingDiscountApplied > 0
                ? <span className="text-green-600 dark:text-green-400 font-medium">FREE</span>
                : formatPrice(displayBaseShipping * 100)
              }
            </span>
          </div>
        )}
        {insuranceFee > 0 && (
          <div className="flex justify-between text-sm" style={{ opacity: 0.65 }}>
            <span>Insurance</span>
            <span>{displayInsurance === 0
              ? <span className="text-green-600 dark:text-green-400 font-medium">FREE</span>
              : formatPrice(displayInsurance * 100)}
            </span>
          </div>
        )}
        {actualSurcharge ? (
          <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
            <span>Surcharge ({actualSurcharge.percent}%)</span>
            <span>+{formatPrice(actualSurcharge.amount * 100)}</span>
          </div>
        ) : estimatedSurcharge > 0 && phase === "payment" ? (
          <div className="flex justify-between text-sm" style={{ opacity: 0.4 }}>
            <span>Surcharge (credit card only)</span>
            <span>~{formatPrice(estimatedSurcharge * 100)}</span>
          </div>
        ) : null}
        <div className="flex justify-between font-bold text-base pt-2.5" style={{ borderTop: divider }}>
          <span>Total</span>
          <span>{formatPrice(Math.max(0, displayedTotal) * 100)}</span>
        </div>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: bg }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-10">

        <div className="flex items-center gap-2.5 mb-8">
          <Lock className="h-4 w-4" style={{ opacity: 0.35 }} />
          <h1 className="text-xl font-bold tracking-tight">Secure Checkout</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">

          {/* ── Left column ───────────────────────────────────────── */}
          <div className="w-full lg:flex-1 min-w-0 space-y-4">

            {/* 1 — Shipping Address */}
            <Section num={1} title="Shipping Address" state={s1} summary={addrSummary} onEdit={editAddress}>
              <AddressFields
                value={address}
                onChange={a => {
                  setAddress(a);
                  if (sameAsShipping) setBillingAddress(a);
                  if (appliedPromo?.discount_type === "free_shipping" && !appliedPromo.allow_international && a.country !== "US") {
                    removePromoCode().then(() => { setAppliedPromo(null); setPromoError("Promo removed — not valid for international orders."); });
                  }
                }}
                errors={addrErrors}
                allowedCountries={allowedCountries}
              />
              {addrError && (
                <p className="text-sm text-red-400 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {addrError}
                </p>
              )}
              <button onClick={continueFromAddress} disabled={addrLoading}
                className="w-full rounded-xl py-3.5 text-sm font-bold tracking-wide transition-opacity hover:opacity-85 disabled:opacity-40 flex items-center justify-center gap-2"
                style={btnPrimary}>
                {addrLoading ? <><Spinner className="h-4 w-4" /> Calculating shipping…</> : "Continue to Billing Address"}
              </button>
            </Section>

            {/* 2 — Billing Address */}
            <Section num={2} title="Billing Address" state={s2} summary={billSummary} onEdit={editBilling}>
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameAsShipping}
                  onChange={e => {
                    setSameAsShipping(e.target.checked);
                    if (e.target.checked) setBillingAddress(address);
                  }}
                  className="h-4 w-4 rounded accent-current"
                />
                <span className="text-sm font-medium">Same as shipping address</span>
              </label>

              {!sameAsShipping && (
                <AddressFields
                  value={billingAddress}
                  onChange={setBillingAddress}
                  errors={billErrors}
                  allowedCountries={allowedCountries}
                />
              )}

              {sameAsShipping && address.address_line1 && (
                <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ backgroundColor: mix(6), opacity: 0.6 }}>
                  {address.name && <>{address.name}, </>}
                  {address.address_line1}
                  {address.address_line2 ? `, ${address.address_line2}` : ""},{" "}
                  {address.city}{address.state ? `, ${address.state}` : ""} {address.zip}
                </div>
              )}

              {billError && (
                <p className="text-sm text-red-400 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {billError}
                </p>
              )}

              <button onClick={continueFromBilling} disabled={billLoading}
                className="w-full rounded-xl py-3.5 text-sm font-bold tracking-wide transition-opacity hover:opacity-85 disabled:opacity-40 flex items-center justify-center gap-2"
                style={btnPrimary}>
                {billLoading ? <><Spinner className="h-4 w-4" /> Preparing payment…</> : <><Lock className="h-3.5 w-3.5" /> Continue to Payment</>}
              </button>
            </Section>

            {/* 3 — Shipping Method (auto-locked with Edit, or open for editing) */}
            <Section num={3} title="Shipping Method" state={s3} summary={rateSummary} onEdit={() => setShippingEditOpen(true)}>
              {/* Rate selector (only shown when shippingEditOpen) */}
              <div className="space-y-2">
                {rates.map(rate => (
                  <label key={rate.id}
                    className="flex items-center gap-3 rounded-xl p-3.5 cursor-pointer transition-all"
                    style={selectedRate?.id === rate.id
                      ? { border: `1.5px solid ${fg}`, backgroundColor: mix(7) }
                      : rowStyle
                    }>
                    <input type="radio" name="shipping_rate" value={rate.id}
                      checked={selectedRate?.id === rate.id}
                      onChange={() => {}}
                      onClick={() => handleRateChange(rate)}
                      className="shrink-0 accent-current" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{rate.carrier} {rate.service}</p>
                      {rate.delivery_days != null && (
                        <p className="text-xs mt-0.5" style={{ opacity: 0.45 }}>
                          {rate.delivery_days} business {rate.delivery_days === 1 ? "day" : "days"}
                        </p>
                      )}
                      {selectedRate?.id === rate.id && (insuranceRequired || signatureRequired) && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5">
                          {insuranceRequired && <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: mixT(10) }}>Insured (+{formatPrice(insuranceFee * 100)})</span>}
                          {signatureRequired && <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: mixT(10) }}>Signature required</span>}
                        </div>
                      )}
                    </div>
                    <span className="font-bold text-sm shrink-0">{formatPrice(parseFloat(rate.rate) * 100)}</span>
                  </label>
                ))}
              </div>
              <button onClick={() => setShippingEditOpen(false)}
                className="w-full rounded-xl py-3 text-sm font-bold tracking-wide transition-opacity hover:opacity-85 flex items-center justify-center"
                style={btnPrimary}>
                Confirm Shipping Method
              </button>
            </Section>

            {/* Order summary — mobile only, sits between shipping method and payment */}
            <div className="block lg:hidden">{orderSummaryCard}</div>

            {/* 4 — Payment */}
            <Section num={4} title="Payment" state={s4}>
              {checkoutConfig?.restocking_fee_active && checkoutConfig.restocking_fee_disclaimer && (
                <p className="text-xs leading-relaxed" style={{ opacity: 0.45 }}>
                  {checkoutConfig.restocking_fee_disclaimer}
                </p>
              )}

              {paymentLoading && (
                <div className="rounded-xl py-8 flex items-center justify-center gap-2" style={rowStyle}>
                  <span style={{ opacity: 0.4 }}><Spinner className="h-4 w-4" /></span>
                  <span className="text-sm" style={{ opacity: 0.4 }}>Updating payment…</span>
                </div>
              )}

              {clientSecret && orderIdForPayment && !paymentLoading && (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
                  <PaymentForm
                    clientSecret={clientSecret}
                    orderId={orderIdForPayment}
                    baseTotal={baseTotal}
                    displayTotal={displayedTotal}
                    surchargeConfig={surchargeConfig}
                    billingAddress={effectiveBilling}
                    onPaymentTypeChange={setSelectedPaymentType}
                    onSurchargeApplied={setActualSurcharge}
                  />
                </Elements>
              )}
            </Section>

          </div>

          {/* ── Right: Order Summary — desktop sidebar only ──────── */}
          <div className="hidden lg:block lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-6">
            {orderSummaryCard}
          </div>

        </div>
      </div>
    </div>
  );
}
