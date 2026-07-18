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
import { X, Lock, ShieldCheck, Check, Pencil, Tag } from "lucide-react";
import { SUBDIVISIONS, getSubdivisionLabel, getCountryName } from "@/lib/data/countries";
import type { Country } from "@/lib/data/countries";
import type { EasyPostRate, ShippingAddress, UserAddress, CheckoutConfig, SurchargeConfig } from "@/types";
import { EASYPOST_MAX_INSURABLE_VALUE } from "@/lib/easypost/protection";

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
    ".Tab": { border: "1.5px solid #e5e7eb", boxShadow: "none", padding: "10px 16px", minHeight: "52px" },
    ".Tab:hover": { borderColor: "#d1d5db", backgroundColor: "#f9fafb" },
    ".Tab--selected": { border: "1.5px solid #18181b", backgroundColor: "#f9fafb" },
    ".Tab--selected:hover": { backgroundColor: "#f3f4f6" },
    ".TabIcon": { height: "24px" },
    ".TabIcon--selected": { height: "24px" },
    ".Block": { border: "1.5px solid #e5e7eb" },
  },
};

// ── Shared style constants ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--site-fg) 5%, var(--site-bg))",
  color: "var(--site-fg)",
  border: "1px solid color-mix(in srgb, var(--site-fg) 18%, transparent)",
};
const inputErrorStyle: React.CSSProperties = { ...inputStyle, border: "1px solid rgb(248 113 113)" };
const btnPrimaryStyle: React.CSSProperties = { backgroundColor: "var(--site-fg)", color: "var(--site-bg)" };
const cardStyle: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--site-fg) 4%, var(--site-bg))",
  border: "1px solid color-mix(in srgb, var(--site-fg) 12%, transparent)",
  borderRadius: "14px",
};
const innerCardStyle: React.CSSProperties = {
  backgroundColor: "color-mix(in srgb, var(--site-fg) 6%, var(--site-bg))",
  border: "1px solid color-mix(in srgb, var(--site-fg) 10%, transparent)",
  borderRadius: "10px",
};
const dividerBorder = "1px solid color-mix(in srgb, var(--site-fg) 10%, transparent)";
const inputClass = "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-current transition-colors";

// ── Section card ───────────────────────────────────────────────────────────────

function Section({
  num, title, locked, summary, onEdit, children,
}: {
  num: number;
  title: string;
  locked?: boolean;
  summary?: string;
  onEdit?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div style={cardStyle}>
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
            style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)" }}
          >
            {locked ? <Check className="h-3.5 w-3.5" /> : num}
          </div>
          <span className="font-semibold text-sm">{title}</span>
          {locked && summary && (
            <span className="text-xs truncate" style={{ opacity: 0.5 }}>{summary}</span>
          )}
        </div>
        {locked && onEdit && (
          <button
            onClick={onEdit}
            className="flex items-center gap-1 text-xs font-medium shrink-0 ml-3 transition-opacity hover:opacity-100"
            style={{ opacity: 0.45 }}
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        )}
      </div>
      {!locked && children && (
        <div className="px-5 pb-5 pt-4 space-y-4" style={{ borderTop: dividerBorder }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ── PaymentForm (must be inside <Elements>) ────────────────────────────────────

interface PaymentFormProps {
  clientSecret: string;
  orderId: string;
  baseTotal: number;
  surchargeConfig?: SurchargeConfig | null;
  shippingCountry: string;
  shippingZip: string;
  onPaymentTypeChange: (type: string) => void;
  onSurchargeApplied: (s: { amount: number; percent: number } | null) => void;
}

function PaymentForm({
  clientSecret, orderId, baseTotal, surchargeConfig,
  shippingCountry, shippingZip, onPaymentTypeChange, onSurchargeApplied,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surcharge, setSurcharge] = useState<{ amount: number; percent: number } | null>(null);
  const [hasExpress, setHasExpress] = useState(false);
  const [selectedType, setSelectedType] = useState("card");

  const displayTotal = surcharge ? baseTotal + surcharge.amount : baseTotal;
  const isRedirectMethod = selectedType === "klarna" || selectedType === "amazon_pay";

  function handleTypeChange(type: string) {
    setSelectedType(type);
    onPaymentTypeChange(type);
    if (type !== "card" && surcharge) {
      setSurcharge(null);
      onSurchargeApplied(null);
    }
  }

  async function handleExpressConfirm() {
    if (!stripe || !elements) return;
    const { error: err } = await stripe.confirmPayment({
      elements, clientSecret,
      confirmParams: { return_url: `${window.location.origin}/checkout/success` },
    });
    if (err) setError(err.message ?? "Payment failed. Please try again.");
  }

  async function handlePay() {
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) {
      setError(submitErr.message ?? "Please check your payment details.");
      setLoading(false);
      return;
    }

    if (isRedirectMethod) {
      const { error: confirmErr } = await stripe.confirmPayment({
        elements, clientSecret,
        confirmParams: { return_url: `${window.location.origin}/checkout/success` },
      });
      if (confirmErr) { setError(confirmErr.message ?? "Payment failed."); setLoading(false); }
      return;
    }

    const { paymentMethod, error: pmErr } = await stripe.createPaymentMethod({ elements });
    if (pmErr || !paymentMethod) {
      setError(pmErr?.message ?? "Unable to process payment method.");
      setLoading(false);
      return;
    }

    if (paymentMethod.card?.funding === "credit" && surchargeConfig?.surcharge_active) {
      const intentId = clientSecret.split("_secret_")[0];
      const res = await fetch("/api/checkout/update-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId, orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update payment amount.");
        setLoading(false);
        return;
      }
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
    if (confirmErr) {
      setError(confirmErr.message ?? "Payment failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ExpressCheckoutElement
        onReady={(e) => setHasExpress(!!(e as any).availablePaymentMethods)}
        onConfirm={handleExpressConfirm}
        options={{
          buttonHeight: 50,
          paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", klarna: "never", amazonPay: "never", paypal: "never" },
        }}
      />

      {hasExpress && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 12%, transparent)" }} />
          <span className="text-xs uppercase tracking-widest" style={{ opacity: 0.35 }}>or pay with</span>
          <div className="flex-1 h-px" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 12%, transparent)" }} />
        </div>
      )}

      <PaymentElement
        onChange={(e) => handleTypeChange(e.value.type)}
        options={{
          layout: "tabs",
          fields: { billingDetails: { address: { country: "never", postalCode: "never" } } },
          defaultValues: { billingDetails: { address: { country: shippingCountry, postal_code: shippingZip } } },
        }}
      />

      {surchargeConfig?.surcharge_active && surchargeConfig.surcharge_message && !surcharge && selectedType === "card" && (
        <p className="text-xs px-1" style={{ opacity: 0.5 }}>{surchargeConfig.surcharge_message}</p>
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
        style={btnPrimaryStyle}
      >
        {loading ? (
          <><Spinner className="h-4 w-4" /> Processing…</>
        ) : isRedirectMethod ? (
          <>Continue with {selectedType === "klarna" ? "Klarna" : "Amazon Pay"} →</>
        ) : (
          <><Lock className="h-3.5 w-3.5" /> Pay {formatPrice(Math.round(displayTotal * 100))}</>
        )}
      </button>

      <div className="flex items-center justify-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" style={{ opacity: 0.28 }} />
        <span className="text-xs" style={{ opacity: 0.28 }}>Payments secured by Stripe</span>
      </div>
    </div>
  );
}

// ── Main checkout ──────────────────────────────────────────────────────────────

export function CheckoutFlow({
  allowedCountries,
  defaultShipping,
  initialPromo,
  checkoutConfig,
  surchargeConfig,
}: {
  allowedCountries: Country[];
  defaultShipping: UserAddress | null;
  initialPromo?: AppliedPromo | null;
  checkoutConfig?: CheckoutConfig | null;
  surchargeConfig?: SurchargeConfig | null;
}) {
  const { items, subtotal, reloadCart } = useCart();
  const defaultCountry = allowedCountries[0]?.code ?? "US";

  // Address
  const [address, setAddress] = useState<ShippingAddress>({
    name: defaultShipping ? `${defaultShipping.first_name} ${defaultShipping.last_name}`.trim() : "",
    address_line1: defaultShipping?.address_line1 ?? "",
    address_line2: defaultShipping?.address_line2 ?? "",
    city: defaultShipping?.city ?? "",
    state: defaultShipping?.state ?? "",
    zip: defaultShipping?.zip ?? "",
    country: defaultShipping?.country ?? defaultCountry,
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});
  const [addressLocked, setAddressLocked] = useState(false);

  // Shipping
  const [rates, setRates] = useState<EasyPostRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<EasyPostRate | null>(null);
  const [shippingLocked, setShippingLocked] = useState(false);
  const [insuranceRequired, setInsuranceRequired] = useState(false);
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [insuranceFee, setInsuranceFee] = useState(0);

  // Promo
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(initialPromo ?? null);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  // Payment
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderIdForPayment, setOrderIdForPayment] = useState<string | null>(null);
  const [baseTotal, setBaseTotal] = useState(0);
  const [selectedPaymentType, setSelectedPaymentType] = useState("card");
  const [actualSurcharge, setActualSurcharge] = useState<{ amount: number; percent: number } | null>(null);

  // Global loading / error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derived values
  const subdivisions = SUBDIVISIONS[address.country] ?? [];
  const hasSubdivisions = subdivisions.length > 0;
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

  // Estimated surcharge (card tab selected, before payment)
  const isCardSelected = selectedPaymentType === "card";
  let estimatedSurcharge = 0;
  let surchargePercent = 0;
  if (isCardSelected && surchargeConfig?.surcharge_active && (surchargeConfig.surcharge_percent ?? 0) > 0 && selectedRate && !actualSurcharge) {
    const minOrder = surchargeConfig.surcharge_min_order ?? 0;
    if (minOrder === 0 || discountedSubtotal >= minOrder) {
      surchargePercent = Math.min(surchargeConfig.surcharge_percent, 4);
      estimatedSurcharge = Math.round(discountedSubtotal * surchargePercent / 100 * 100) / 100;
    }
  }

  const effectiveTotal = discountedSubtotal + displayBaseShipping + displayInsurance;
  const displayedTotal = clientSecret
    ? baseTotal + (actualSurcharge?.amount ?? 0)
    : effectiveTotal + (estimatedSurcharge);

  const addressSummaryLine = [
    address.address_line1,
    address.city,
    [address.state, address.zip].filter(Boolean).join(" "),
    address.country !== defaultCountry ? getCountryName(address.country) : null,
  ].filter(Boolean).join(", ");

  const shippingSummaryLine = selectedRate
    ? `${selectedRate.carrier} ${selectedRate.service} · ${formatPrice(parseFloat(selectedRate.rate) * 100)}`
    : "";

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-6" style={{ opacity: 0.5 }}>Your cart is empty.</p>
        <a href="/products"
          className="inline-block rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
          style={btnPrimaryStyle}>
          Browse Products
        </a>
      </div>
    );
  }

  function validateAddress() {
    const errs: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!address.name.trim()) errs.name = "Full name is required";
    if (!address.address_line1.trim()) errs.address_line1 = "Street address is required";
    if (!address.city.trim()) errs.city = "City is required";
    if (hasSubdivisions && !address.state) errs.state = `${getSubdivisionLabel(address.country)} is required`;
    if (!address.zip.trim()) errs.zip = "Postal code is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function fetchRates() {
    if (!validateAddress()) return;
    setLoading(true);
    setError(null);
    try {
      const { valid, issues } = await validateAndSyncCart();
      if (!valid) {
        await reloadCart();
        setError(issues.map(i =>
          i.issue === "removed"
            ? `"${i.name}" is no longer available and was removed.`
            : `"${i.name}" quantity reduced to ${i.newQuantity}.`
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
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch shipping rates");
      const sorted = [...(data.rates as EasyPostRate[])].sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
      setRates(sorted);
      setSelectedRate(sorted[0] ?? null);
      setInsuranceRequired(!!data.insuranceRequired);
      setSignatureRequired(!!data.signatureRequired);
      setInsuranceFee(parseFloat(data.insuranceFee ?? "0"));
      setAddressLocked(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function preparePayment() {
    if (!selectedRate) return;
    setLoading(true);
    setError(null);
    try {
      const { valid, issues } = await validateAndSyncCart();
      if (!valid) {
        await reloadCart();
        setError(issues.map(i =>
          i.issue === "removed"
            ? `"${i.name}" is no longer available and was removed.`
            : `"${i.name}" quantity reduced to ${i.newQuantity}.`
        ).join(" ") + " Please review before continuing.");
        return;
      }
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
      setShippingLocked(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function editAddress() {
    setAddressLocked(false);
    setShippingLocked(false);
    setRates([]);
    setSelectedRate(null);
    setClientSecret(null);
    setOrderIdForPayment(null);
    setBaseTotal(0);
    setActualSurcharge(null);
    setError(null);
  }

  function editShipping() {
    setShippingLocked(false);
    setClientSecret(null);
    setOrderIdForPayment(null);
    setBaseTotal(0);
    setActualSurcharge(null);
    setError(null);
  }

  async function handleApplyPromo() {
    if (!promoInput.trim()) return;
    setPromoLoading(true);
    setPromoError(null);
    const result = await applyPromoCode(promoInput.trim());
    setPromoLoading(false);
    if (!result.ok) { setPromoError(result.error ?? "Invalid promo code."); return; }
    if (result.promo!.discount_type === "free_shipping" && !result.promo!.allow_international && address.country !== "US") {
      await removePromoCode();
      setPromoError("This promo code is not valid for international orders.");
      return;
    }
    setAppliedPromo(result.promo!);
    setPromoInput("");
  }

  async function handleRemovePromo() {
    setPromoLoading(true);
    await removePromoCode();
    setAppliedPromo(null);
    setPromoError(null);
    setPromoLoading(false);
  }

  return (
    // z-index 50 puts checkout content above the fixed striation overlay (z-index 45)
    <div className="relative min-h-screen" style={{ backgroundColor: "var(--site-bg)", zIndex: 50 }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-10">

        {/* Page title */}
        <div className="flex items-center gap-2.5 mb-8">
          <Lock className="h-4 w-4" style={{ opacity: 0.35 }} />
          <h1 className="text-xl font-bold tracking-tight">Secure Checkout</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">

          {/* ── Left column: steps ──────────────────────────────── */}
          <div className="w-full lg:flex-1 min-w-0 space-y-4">

            {/* Step 1 — Shipping Address */}
            <Section
              num={1}
              title="Shipping Address"
              locked={addressLocked}
              summary={addressSummaryLine}
              onEdit={editAddress}
            >
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.6 }}>Full Name</label>
                <input
                  value={address.name}
                  onChange={e => setAddress(a => ({ ...a, name: e.target.value }))}
                  placeholder="Jane Smith"
                  autoComplete="name"
                  className={inputClass}
                  style={fieldErrors.name ? inputErrorStyle : inputStyle}
                />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.6 }}>Country</label>
                <select
                  value={address.country}
                  onChange={e => {
                    const c = e.target.value;
                    setAddress(a => ({ ...a, country: c, state: "" }));
                    if (appliedPromo?.discount_type === "free_shipping" && !appliedPromo.allow_international && c !== "US") {
                      removePromoCode().then(() => {
                        setAppliedPromo(null);
                        setPromoError("This promo code is not valid for international orders and has been removed.");
                      });
                    }
                  }}
                  className={inputClass}
                  style={inputStyle}
                >
                  {allowedCountries.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.6 }}>Street Address</label>
                <input
                  value={address.address_line1}
                  onChange={e => setAddress(a => ({ ...a, address_line1: e.target.value }))}
                  placeholder="123 Main St"
                  autoComplete="address-line1"
                  className={inputClass}
                  style={fieldErrors.address_line1 ? inputErrorStyle : inputStyle}
                />
                {fieldErrors.address_line1 && <p className="mt-1 text-xs text-red-400">{fieldErrors.address_line1}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.6 }}>Apt, Suite, etc. <span style={{ opacity: 0.5 }}>(optional)</span></label>
                <input
                  value={address.address_line2 ?? ""}
                  onChange={e => setAddress(a => ({ ...a, address_line2: e.target.value }))}
                  autoComplete="address-line2"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <div className={`grid gap-3 ${hasSubdivisions ? "grid-cols-3" : "grid-cols-2"}`}>
                <div className={hasSubdivisions ? "col-span-1" : ""}>
                  <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.6 }}>City</label>
                  <input
                    value={address.city}
                    onChange={e => setAddress(a => ({ ...a, city: e.target.value }))}
                    autoComplete="address-level2"
                    className={inputClass}
                    style={fieldErrors.city ? inputErrorStyle : inputStyle}
                  />
                  {fieldErrors.city && <p className="mt-1 text-xs text-red-400">{fieldErrors.city}</p>}
                </div>

                {hasSubdivisions && (
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.6 }}>
                      {getSubdivisionLabel(address.country)}
                    </label>
                    <select
                      value={address.state}
                      onChange={e => setAddress(a => ({ ...a, state: e.target.value }))}
                      className={inputClass}
                      style={fieldErrors.state ? inputErrorStyle : inputStyle}
                    >
                      <option value="">Select…</option>
                      {subdivisions.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
                    </select>
                    {fieldErrors.state && <p className="mt-1 text-xs text-red-400">{fieldErrors.state}</p>}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.6 }}>
                    {address.country === "GB" ? "Postcode" : "ZIP Code"}
                  </label>
                  <input
                    value={address.zip}
                    onChange={e => setAddress(a => ({ ...a, zip: e.target.value }))}
                    autoComplete="postal-code"
                    className={inputClass}
                    style={fieldErrors.zip ? inputErrorStyle : inputStyle}
                  />
                  {fieldErrors.zip && <p className="mt-1 text-xs text-red-400">{fieldErrors.zip}</p>}
                </div>
              </div>

              {error && (
                <p className="text-sm text-red-400 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {error}
                </p>
              )}

              <button
                onClick={fetchRates}
                disabled={loading}
                className="w-full rounded-xl py-3.5 text-sm font-bold tracking-wide transition-opacity hover:opacity-85 disabled:opacity-40 flex items-center justify-center gap-2"
                style={btnPrimaryStyle}
              >
                {loading ? <><Spinner className="h-4 w-4" /> Getting rates…</> : "Continue to Shipping"}
              </button>
            </Section>

            {/* Step 2 — Shipping Method */}
            {rates.length > 0 && (
              <Section
                num={2}
                title="Shipping Method"
                locked={shippingLocked}
                summary={shippingSummaryLine}
                onEdit={editShipping}
              >
                {rates.length === 0 ? (
                  <p className="text-sm" style={{ opacity: 0.4 }}>No rates available for this address.</p>
                ) : (
                  <div className="space-y-2">
                    {rates.map(rate => (
                      <label
                        key={rate.id}
                        className="flex items-center gap-3 rounded-xl p-3.5 cursor-pointer transition-all"
                        style={selectedRate?.id === rate.id
                          ? { border: "1.5px solid var(--site-fg)", backgroundColor: "color-mix(in srgb, var(--site-fg) 7%, var(--site-bg))" }
                          : innerCardStyle
                        }
                      >
                        <input
                          type="radio"
                          name="shipping_rate"
                          value={rate.id}
                          checked={selectedRate?.id === rate.id}
                          onChange={() => setSelectedRate(rate)}
                          className="shrink-0 accent-current"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{rate.carrier} {rate.service}</p>
                          {rate.delivery_days != null && (
                            <p className="text-xs mt-0.5" style={{ opacity: 0.45 }}>
                              {rate.delivery_days} business {rate.delivery_days === 1 ? "day" : "days"}
                            </p>
                          )}
                          {(insuranceRequired || signatureRequired) && selectedRate?.id === rate.id && (
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {insuranceRequired && (
                                <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 10%, transparent)" }}>
                                  Insured (+{formatPrice(insuranceFee * 100)})
                                </span>
                              )}
                              {signatureRequired && (
                                <span className="text-xs rounded-full px-2 py-0.5" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 10%, transparent)" }}>
                                  Signature required
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <span className="font-semibold text-sm shrink-0">{formatPrice(parseFloat(rate.rate) * 100)}</span>
                      </label>
                    ))}
                  </div>
                )}

                {error && (
                  <p className="text-sm text-red-400 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {error}
                  </p>
                )}

                {checkoutConfig?.restocking_fee_active && checkoutConfig.restocking_fee_disclaimer && (
                  <p className="text-xs leading-relaxed" style={{ opacity: 0.5 }}>
                    {checkoutConfig.restocking_fee_disclaimer}
                  </p>
                )}

                <button
                  onClick={preparePayment}
                  disabled={loading || !selectedRate}
                  className="w-full rounded-xl py-3.5 text-sm font-bold tracking-wide transition-opacity hover:opacity-85 disabled:opacity-40 flex items-center justify-center gap-2"
                  style={btnPrimaryStyle}
                >
                  {loading ? <><Spinner className="h-4 w-4" /> Preparing payment…</> : <><Lock className="h-3.5 w-3.5" /> Continue to Payment</>}
                </button>
              </Section>
            )}

            {/* Step 3 — Payment */}
            {clientSecret && orderIdForPayment && (
              <Section num={3} title="Payment Details">
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
                  <PaymentForm
                    clientSecret={clientSecret}
                    orderId={orderIdForPayment}
                    baseTotal={baseTotal}
                    surchargeConfig={surchargeConfig}
                    shippingCountry={address.country}
                    shippingZip={address.zip}
                    onPaymentTypeChange={setSelectedPaymentType}
                    onSurchargeApplied={setActualSurcharge}
                  />
                </Elements>
              </Section>
            )}

          </div>

          {/* ── Right column: Order Summary ──────────────────────── */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-6">
            <div style={cardStyle} className="overflow-hidden">
              <div className="px-5 py-4">
                <h3 className="font-bold text-sm tracking-wide">Order Summary</h3>
              </div>

              {/* Items */}
              <div className="px-5 pb-4 space-y-3" style={{ borderTop: dividerBorder, paddingTop: "16px" }}>
                {items.map(item => (
                  <div key={item.productId} className="flex gap-3 items-start">
                    {item.image && (
                      <div
                        className="h-12 w-12 shrink-0 rounded-lg overflow-hidden"
                        style={{ backgroundImage: `url(${item.image})`, backgroundSize: "cover", backgroundPosition: "center", backgroundColor: "color-mix(in srgb, var(--site-fg) 8%, var(--site-bg))" }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-snug" style={{ opacity: 0.85 }}>{item.name}</p>
                      <p className="text-xs mt-0.5" style={{ opacity: 0.4 }}>Qty {item.quantity}</p>
                    </div>
                    <span className="text-xs font-semibold shrink-0">{formatPrice(item.price * item.quantity * 100)}</span>
                  </div>
                ))}
              </div>

              {/* Promo code */}
              <div className="px-5 py-4 space-y-2" style={{ borderTop: dividerBorder }}>
                {appliedPromo ? (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Tag className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">{appliedPromo.code} applied</span>
                    </div>
                    <button
                      onClick={handleRemovePromo}
                      disabled={promoLoading}
                      className="flex items-center gap-0.5 text-xs transition-opacity hover:opacity-100"
                      style={{ opacity: 0.4 }}
                    >
                      <X className="h-3 w-3" /> Remove
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={e => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                        onKeyDown={e => e.key === "Enter" && handleApplyPromo()}
                        placeholder="Promo code"
                        className="flex-1 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-current"
                        style={inputStyle}
                      />
                      <button
                        onClick={handleApplyPromo}
                        disabled={promoLoading || !promoInput.trim()}
                        className="rounded-lg px-3 py-2 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-35 flex items-center gap-1"
                        style={btnPrimaryStyle}
                      >
                        {promoLoading ? <Spinner className="h-3 w-3" /> : "Apply"}
                      </button>
                    </div>
                    {promoError && <p className="text-xs text-red-400">{promoError}</p>}
                  </div>
                )}
              </div>

              {/* Price breakdown */}
              <div className="px-5 pb-5 space-y-2.5" style={{ borderTop: dividerBorder, paddingTop: "16px" }}>
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
                    <span>
                      Shipping
                      {d?.shippingDiscount ? <span className="ml-1 text-xs text-green-600 dark:text-green-400">({appliedPromo!.code})</span> : null}
                    </span>
                    {shippingDiscountApplied > 0
                      ? <span>
                          <span style={{ opacity: 0.4 }}>{formatPrice(rawBaseShipping * 100)}</span>
                          {" "}
                          {displayBaseShipping === 0
                            ? <span className="text-green-600 dark:text-green-400 font-medium">FREE</span>
                            : <><span className="text-green-600 dark:text-green-400">−{formatPrice(shippingDiscountApplied * 100)}</span></>
                          }
                        </span>
                      : <span>{formatPrice(displayBaseShipping * 100)}</span>
                    }
                  </div>
                )}

                {insuranceFee > 0 && (
                  <div className="flex justify-between text-sm" style={{ opacity: 0.65 }}>
                    <span>Insurance</span>
                    <span>{displayInsurance === 0 ? <span className="text-green-600 dark:text-green-400 font-medium">FREE</span> : formatPrice(displayInsurance * 100)}</span>
                  </div>
                )}

                {/* Surcharge — estimated when card tab selected, actual after detection */}
                {actualSurcharge ? (
                  <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
                    <span>Credit card surcharge ({actualSurcharge.percent}%)</span>
                    <span>+{formatPrice(actualSurcharge.amount * 100)}</span>
                  </div>
                ) : estimatedSurcharge > 0 && clientSecret ? (
                  <div className="flex justify-between text-sm" style={{ opacity: 0.5 }}>
                    <span>Surcharge (credit card only)</span>
                    <span>~{formatPrice(estimatedSurcharge * 100)}</span>
                  </div>
                ) : null}

                <div
                  className="flex justify-between font-bold text-base pt-2.5"
                  style={{ borderTop: dividerBorder }}
                >
                  <span>Total</span>
                  <span>{formatPrice(Math.max(0, displayedTotal) * 100)}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
