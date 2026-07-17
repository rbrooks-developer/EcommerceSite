"use client";

import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, ExpressCheckoutElement, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { useCart } from "@/lib/cart/store";
import { validateAndSyncCart } from "@/lib/actions/cart";
import { applyPromoCode, removePromoCode } from "@/lib/actions/promos";
import type { AppliedPromo } from "@/lib/actions/promos";
import { calculatePromoDiscount } from "@/lib/promos/calculate";
import { formatPrice } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { X, Lock, ShieldCheck, ChevronRight } from "lucide-react";
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
    ".Input": {
      border: "1.5px solid #e5e7eb",
      boxShadow: "none",
      padding: "10px 14px",
    },
    ".Input:hover": { borderColor: "#d1d5db" },
    ".Input:focus": {
      border: "1.5px solid #18181b",
      boxShadow: "0 0 0 2px rgba(24,24,27,0.08)",
      outline: "none",
    },
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

type Step = "address" | "shipping" | "review" | "payment";

const panelStyle: React.CSSProperties = {
  border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)",
  backgroundColor: "var(--checkout-section-bg, color-mix(in srgb, var(--site-fg) 5%, var(--site-bg)))",
};

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--checkout-input-bg, color-mix(in srgb, var(--site-fg) 8%, var(--site-bg)))",
  color: "var(--site-fg)",
  border: "1px solid color-mix(in srgb, var(--site-fg) 25%, transparent)",
};

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  border: "1px solid rgb(248 113 113)",
};

const btnPrimaryStyle: React.CSSProperties = {
  backgroundColor: "var(--site-fg)",
  color: "var(--site-bg)",
};

const inputClass = "w-full rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-current";

// ── Inner payment form — must be inside <Elements> to use Stripe hooks ──────

interface PaymentFormProps {
  clientSecret: string;
  orderId: string;
  baseTotal: number;
  surchargeConfig?: SurchargeConfig | null;
  shippingCountry: string;
  shippingZip: string;
  onBack: () => void;
}

function PaymentForm({ clientSecret, orderId, baseTotal, surchargeConfig, shippingCountry, shippingZip, onBack }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [redirectLoading, setRedirectLoading] = useState<"klarna" | "amazonPay" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [surcharge, setSurcharge] = useState<{ amount: number; percent: number } | null>(null);
  const [hasExpress, setHasExpress] = useState(false);

  const displayTotal = surcharge ? baseTotal + surcharge.amount : baseTotal;
  const dividerColor = "color-mix(in srgb, var(--site-fg) 15%, transparent)";
  const anyLoading = loading || !!redirectLoading;

  // Express checkout (Apple Pay, Google Pay) — main card-only intent so no S badge
  async function handleExpressConfirm() {
    if (!stripe || !elements) return;
    setError(null);
    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      clientSecret,
      confirmParams: { return_url: `${window.location.origin}/checkout/success` },
    });
    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
    }
  }

  // Klarna — creates a dedicated Klarna intent then redirects
  async function handleKlarna() {
    if (!stripe || anyLoading) return;
    setRedirectLoading("klarna");
    setError(null);
    try {
      const res = await fetch("/api/checkout/create-redirect-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, method: "klarna" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate Klarna.");
      const { error: confirmError } = await (stripe as any).confirmKlarnaPayment(data.clientSecret, {
        payment_method: { billing_details: { address: { country: shippingCountry } } },
        return_url: `${window.location.origin}/checkout/success`,
      });
      if (confirmError) throw new Error(confirmError.message ?? "Klarna payment failed.");
    } catch (err: any) {
      setError(err.message);
      setRedirectLoading(null);
    }
  }

  // Amazon Pay — creates a dedicated Amazon Pay intent then redirects
  async function handleAmazonPay() {
    if (!stripe || anyLoading) return;
    setRedirectLoading("amazonPay");
    setError(null);
    try {
      const res = await fetch("/api/checkout/create-redirect-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, method: "amazon_pay" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to initiate Amazon Pay.");
      const { error: confirmError } = await stripe.confirmPayment({
        clientSecret: data.clientSecret,
        confirmParams: { return_url: `${window.location.origin}/checkout/success` },
      });
      if (confirmError) throw new Error(confirmError.message ?? "Amazon Pay failed.");
    } catch (err: any) {
      setError(err.message);
      setRedirectLoading(null);
    }
  }

  // Regular card payment with optional surcharge detection
  async function handlePay() {
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Please check your payment details.");
      setLoading(false);
      return;
    }

    const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({ elements });
    if (pmError || !paymentMethod) {
      setError(pmError?.message ?? "Unable to process payment method.");
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
        setSurcharge({ amount: data.surchargeAmount, percent: data.surchargePercentage });
      }
    }

    const { error: confirmError } = await stripe.confirmPayment({
      clientSecret,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
        payment_method: paymentMethod.id,
      },
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">

      {/* Express checkout — Apple Pay and Google Pay (card-only intent = no S badge) */}
      <ExpressCheckoutElement
        onReady={(e) => setHasExpress(!!(e as any).availablePaymentMethods)}
        onConfirm={handleExpressConfirm}
        options={{
          buttonHeight: 52,
          paymentMethods: {
            applePay: "auto",
            googlePay: "auto",
            link: "never",
            klarna: "never",
            amazonPay: "never",
            paypal: "never",
          },
        }}
      />

      {hasExpress && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ backgroundColor: dividerColor }} />
          <span className="text-xs uppercase tracking-wider" style={{ opacity: 0.4 }}>or</span>
          <div className="flex-1 h-px" style={{ backgroundColor: dividerColor }} />
        </div>
      )}

      {/* Klarna — full-color branded button */}
      <button
        onClick={handleKlarna}
        disabled={anyLoading}
        className="w-full rounded-xl flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ height: 52, backgroundColor: "#FFB3C7", border: "none", cursor: "pointer" }}
        aria-label="Pay with Klarna"
      >
        {redirectLoading === "klarna" ? (
          <Spinner className="h-5 w-5 text-zinc-800" />
        ) : (
          <svg viewBox="0 0 120 36" height="24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <text x="60" y="28" textAnchor="middle" fontFamily="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif" fontSize="30" fontWeight="700" fill="#17120E" letterSpacing="-0.5">klarna</text>
          </svg>
        )}
      </button>

      {/* Amazon Pay — full-color branded button */}
      <button
        onClick={handleAmazonPay}
        disabled={anyLoading}
        className="w-full rounded-xl flex items-center justify-center transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ height: 52, backgroundColor: "#FFD814", border: "none", cursor: "pointer" }}
        aria-label="Pay with Amazon Pay"
      >
        {redirectLoading === "amazonPay" ? (
          <Spinner className="h-5 w-5 text-black" />
        ) : (
          <div className="flex flex-col items-center" style={{ gap: 3 }}>
            <span style={{ fontFamily: "Arial, 'Helvetica Neue', sans-serif", fontSize: 13, fontWeight: 400, color: "#000", lineHeight: 1, letterSpacing: 0.2 }}>
              amazon <strong style={{ fontWeight: 700 }}>pay</strong>
            </span>
            <svg width="58" height="9" viewBox="0 0 58 9" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2 5 Q29 10.5 56 5" stroke="#FF9900" strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path d="M52.5 2.5 L56 5 L53 7.5" stroke="#FF9900" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        )}
      </button>

      {/* Divider before card form */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ backgroundColor: dividerColor }} />
        <span className="text-xs uppercase tracking-wider" style={{ opacity: 0.4 }}>or pay with card</span>
        <div className="flex-1 h-px" style={{ backgroundColor: dividerColor }} />
      </div>

      {/* Card form — country and zip pre-filled from shipping address */}
      <PaymentElement
        options={{
          fields: {
            billingDetails: {
              address: {
                country: "never",
                postalCode: "never",
              },
            },
          },
          defaultValues: {
            billingDetails: {
              address: {
                country: shippingCountry,
                postal_code: shippingZip,
              },
            },
          },
        }}
      />

      {surcharge && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)" }}>
          <p className="text-green-700 dark:text-green-400">
            A {surcharge.percent}% credit card surcharge of {formatPrice(surcharge.amount * 100)} has been added.
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
        disabled={!stripe || !elements || anyLoading}
        className="w-full rounded-lg py-4 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2"
        style={btnPrimaryStyle}
      >
        {loading ? (
          <>
            <Spinner className="h-4 w-4" />
            Processing payment…
          </>
        ) : (
          <>
            <Lock className="h-3.5 w-3.5" />
            Pay {formatPrice(Math.round(displayTotal * 100))}
          </>
        )}
      </button>

      <button
        onClick={onBack}
        disabled={anyLoading}
        className="w-full text-sm transition-opacity hover:opacity-70 py-1"
        style={{ opacity: 0.45 }}
      >
        ← Back to review
      </button>

      <div className="flex items-center justify-center gap-1.5 pt-1">
        <ShieldCheck className="h-3.5 w-3.5" style={{ opacity: 0.35 }} />
        <span className="text-xs" style={{ opacity: 0.35 }}>Payments secured by Stripe</span>
      </div>
    </div>
  );
}

// ── Main checkout flow ────────────────────────────────────────────────────────

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

  const [step, setStep] = useState<Step>("address");
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
  const [rates, setRates] = useState<EasyPostRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<EasyPostRate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insuranceRequired, setInsuranceRequired] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(initialPromo ?? null);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [insuranceFee, setInsuranceFee] = useState(0);

  // Payment Element state
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderIdForPayment, setOrderIdForPayment] = useState<string | null>(null);
  const [baseTotal, setBaseTotal] = useState(0);

  const subdivisions = SUBDIVISIONS[address.country] ?? [];
  const hasSubdivisions = subdivisions.length > 0;
  const shippingCost = selectedRate ? parseFloat(selectedRate.rate) : 0;

  const addressSummary = [
    address.address_line1,
    address.city,
    [address.state, address.zip].filter(Boolean).join(" "),
    address.country !== defaultCountry ? getCountryName(address.country) : null,
  ].filter(Boolean).join(", ");

  const dividerStyle: React.CSSProperties = { borderTop: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)" };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-6" style={{ opacity: 0.5 }}>Your cart is empty.</p>
        <a href="/products"
          className="inline-block rounded-md px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
          style={btnPrimaryStyle}>
          Browse Products
        </a>
      </div>
    );
  }

  function validate() {
    const errs: Partial<Record<keyof ShippingAddress, string>> = {};
    if (!address.name.trim()) errs.name = "Full name is required";
    if (!address.address_line1.trim()) errs.address_line1 = "Address is required";
    if (!address.city.trim()) errs.city = "City is required";
    if (hasSubdivisions && !address.state) errs.state = `${getSubdivisionLabel(address.country)} is required`;
    if (!address.zip.trim()) errs.zip = "Postal code is required";
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function fetchRates() {
    if (!validate()) return;
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
        setLoading(false);
        return;
      }
      const res = await fetch("/api/shipping/rates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, offerId: i.offerId ?? null })),
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
      setStep("review");
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
        ).join(" ") + " Please review your cart before continuing.");
        setLoading(false);
        return;
      }
      const res = await fetch("/api/checkout/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, offerId: i.offerId ?? null })),
          shippingAddress: address,
          shippingRate: selectedRate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to prepare payment");
      setClientSecret(data.clientSecret);
      setOrderIdForPayment(data.orderId);
      setBaseTotal(data.totalPrice);
      setStep("payment");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function goBackFromPayment() {
    setStep("review");
    setClientSecret(null);
    setOrderIdForPayment(null);
    setBaseTotal(0);
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

  // ── Order summary calculations ──────────────────────────────────────────────
  const d = appliedPromo ? calculatePromoDiscount(appliedPromo, subtotal, shippingCost, address.country) : null;
  const rawBaseShipping = selectedRate ? parseFloat(selectedRate.rate) - insuranceFee : 0;
  let displayBaseShipping = rawBaseShipping;
  let displayInsurance = insuranceFee;
  if (d && d.shippingDiscount > 0) {
    const leftover = Math.max(0, d.shippingDiscount - rawBaseShipping);
    displayBaseShipping = Math.max(0, rawBaseShipping - d.shippingDiscount);
    displayInsurance = Math.max(0, insuranceFee - leftover);
  }
  const shippingDiscountApplied = rawBaseShipping - displayBaseShipping;
  const insuranceDiscountApplied = insuranceFee - displayInsurance;
  const discountedSubtotalForSurcharge = subtotal - (d?.discountAmount ?? 0);
  let estimatedSurcharge = 0;
  let surchargePercent = 0;
  if (surchargeConfig?.surcharge_active && (surchargeConfig.surcharge_percent ?? 0) > 0 && selectedRate) {
    const minOrder = surchargeConfig.surcharge_min_order ?? 0;
    if (minOrder === 0 || discountedSubtotalForSurcharge >= minOrder) {
      surchargePercent = Math.min(surchargeConfig.surcharge_percent, 4);
      estimatedSurcharge = Math.round(discountedSubtotalForSurcharge * surchargePercent / 100 * 100) / 100;
    }
  }
  const effectiveTotal = discountedSubtotalForSurcharge + (shippingCost - (d?.shippingDiscount ?? 0));

  const breadcrumbSteps: { key: Step; label: string }[] = [
    { key: "address", label: "Address" },
    { key: "review", label: "Review" },
    { key: "payment", label: "Payment" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-4 w-4" style={{ opacity: 0.4 }} />
          <h1 className="text-2xl font-bold">Secure Checkout</h1>
        </div>

        {/* Step breadcrumb */}
        <div className="flex items-center gap-1 text-sm">
          {breadcrumbSteps.map((s, i) => {
            const isActive = step === s.key || (s.key === "review" && step === "shipping");
            const isPast = (
              (s.key === "address" && (step === "review" || step === "shipping" || step === "payment")) ||
              (s.key === "review" && step === "payment")
            );
            return (
              <span key={s.key} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5" style={{ opacity: 0.3 }} />}
                <span
                  className={isActive ? "font-semibold" : ""}
                  style={isActive ? {} : isPast ? { opacity: 0.55 } : { opacity: 0.3 }}
                >
                  {s.label}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">

        {/* ── Left column: step content ──────────────────────────────────── */}
        <div className="flex-1 min-w-0">

          {/* Step 1: Address */}
          {step === "address" && (
            <div className="rounded-xl p-6 space-y-4" style={panelStyle}>
              <h2 className="text-base font-semibold">Shipping Address</h2>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ opacity: 0.7 }}>Full Name</label>
                <input value={address.name} onChange={(e) => setAddress((a) => ({ ...a, name: e.target.value }))}
                  placeholder="Jane Smith" autoComplete="name"
                  className={inputClass} style={fieldErrors.name ? inputErrorStyle : inputStyle} />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ opacity: 0.7 }}>Country</label>
                <select value={address.country}
                  onChange={(e) => {
                    const newCountry = e.target.value;
                    setAddress((a) => ({ ...a, country: newCountry, state: "" }));
                    if (appliedPromo?.discount_type === "free_shipping" && appliedPromo.allow_international === false && newCountry !== "US") {
                      removePromoCode().then(() => {
                        setAppliedPromo(null);
                        setPromoError("This promo code is not valid for international orders and has been removed.");
                      });
                    }
                  }}
                  className={inputClass} style={inputStyle}>
                  {allowedCountries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
              </div>

              {[
                { key: "address_line1" as const, label: "Street Address", placeholder: "123 Main St", autoComplete: "address-line1" },
                { key: "address_line2" as const, label: "Apt, Suite, etc. (optional)", placeholder: "", autoComplete: "address-line2" },
              ].map(({ key, label, placeholder, autoComplete }) => (
                <div key={key}>
                  <label className="block text-sm font-medium mb-1" style={{ opacity: 0.7 }}>{label}</label>
                  <input type="text" value={address[key] ?? ""}
                    onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
                    placeholder={placeholder} autoComplete={autoComplete}
                    className={inputClass} style={fieldErrors[key] ? inputErrorStyle : inputStyle} />
                  {fieldErrors[key] && <p className="mt-1 text-xs text-red-400">{fieldErrors[key]}</p>}
                </div>
              ))}

              <div className={`grid gap-4 ${hasSubdivisions ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
                <div className={hasSubdivisions ? "col-span-2 sm:col-span-1" : ""}>
                  <label className="block text-sm font-medium mb-1" style={{ opacity: 0.7 }}>City</label>
                  <input value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                    autoComplete="address-level2"
                    className={inputClass} style={fieldErrors.city ? inputErrorStyle : inputStyle} />
                  {fieldErrors.city && <p className="mt-1 text-xs text-red-400">{fieldErrors.city}</p>}
                </div>

                {hasSubdivisions && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ opacity: 0.7 }}>
                      {getSubdivisionLabel(address.country)}
                    </label>
                    <select value={address.state}
                      onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))}
                      className={inputClass} style={fieldErrors.state ? inputErrorStyle : inputStyle}>
                      <option value="">Select…</option>
                      {subdivisions.map((s) => (
                        <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                      ))}
                    </select>
                    {fieldErrors.state && <p className="mt-1 text-xs text-red-400">{fieldErrors.state}</p>}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1" style={{ opacity: 0.7 }}>
                    {address.country === "GB" ? "Postcode" : "ZIP / Postal Code"}
                  </label>
                  <input value={address.zip} onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
                    autoComplete="postal-code"
                    className={inputClass} style={fieldErrors.zip ? inputErrorStyle : inputStyle} />
                  {fieldErrors.zip && <p className="mt-1 text-xs text-red-400">{fieldErrors.zip}</p>}
                </div>
              </div>

              {error && <p className="text-sm text-red-400 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</p>}

              <button onClick={fetchRates} disabled={loading}
                className="w-full rounded-lg py-3.5 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2"
                style={btnPrimaryStyle}>
                {loading && <Spinner className="h-4 w-4" />}
                {loading ? "Getting rates…" : "Continue to Shipping"}
              </button>
            </div>
          )}

          {/* Step: Edit shipping (modal-like sub-step) */}
          {step === "shipping" && (
            <div className="rounded-xl p-6 space-y-4" style={panelStyle}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Shipping Method</h2>
                <button onClick={() => setStep("review")} className="text-xs transition-opacity hover:opacity-70" style={{ opacity: 0.45 }}>
                  ← Back to review
                </button>
              </div>
              <p className="text-sm" style={{ opacity: 0.55 }}>{address.name} · {addressSummary}</p>
              {rates.length === 0 ? (
                <p className="text-sm" style={{ opacity: 0.4 }}>No rates available for this address.</p>
              ) : (
                <div className="space-y-2">
                  {rates.map((rate) => (
                    <label key={rate.id}
                      className="flex items-center gap-3 rounded-lg p-3.5 cursor-pointer transition-all"
                      style={selectedRate?.id === rate.id
                        ? { border: "1.5px solid var(--site-fg)", backgroundColor: "color-mix(in srgb, var(--site-fg) 8%, var(--site-bg))" }
                        : { border: "1px solid color-mix(in srgb, var(--site-fg) 18%, transparent)" }
                      }>
                      <input type="radio" name="shipping_rate" value={rate.id}
                        checked={selectedRate?.id === rate.id} onChange={() => setSelectedRate(rate)} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{rate.carrier} {rate.service}</p>
                        {rate.delivery_days != null && (
                          <p className="text-xs" style={{ opacity: 0.45 }}>
                            {rate.delivery_days} business {rate.delivery_days === 1 ? "day" : "days"}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold text-sm shrink-0">{formatPrice(parseFloat(rate.rate) * 100)}</span>
                    </label>
                  ))}
                </div>
              )}
              <button onClick={() => setStep("review")} disabled={!selectedRate}
                className="w-full rounded-lg py-3.5 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
                style={btnPrimaryStyle}>
                Confirm Shipping
              </button>
            </div>
          )}

          {/* Step 2: Review */}
          {step === "review" && (
            <div className="rounded-xl p-6 space-y-5" style={panelStyle}>
              <h2 className="text-base font-semibold">Order Review</h2>

              {/* Shipping to */}
              <div className="rounded-lg p-4 space-y-1" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 4%, var(--site-bg))", border: "1px solid color-mix(in srgb, var(--site-fg) 12%, transparent)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ opacity: 0.4 }}>Ship to</p>
                    <p className="text-sm" style={{ opacity: 0.85 }}>
                      {address.name}<br />
                      {address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}<br />
                      {address.city}{address.state ? `, ${address.state}` : ""} {address.zip}
                      {address.country !== defaultCountry && <><br />{getCountryName(address.country)}</>}
                    </p>
                  </div>
                  <button onClick={() => setStep("address")} className="text-xs shrink-0 transition-opacity hover:opacity-80 font-medium" style={{ opacity: 0.5 }}>
                    Edit
                  </button>
                </div>
              </div>

              {/* Shipping method */}
              <div className="rounded-lg p-4 space-y-1" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 4%, var(--site-bg))", border: "1px solid color-mix(in srgb, var(--site-fg) 12%, transparent)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ opacity: 0.4 }}>Shipping</p>
                    <p className="text-sm font-medium" style={{ opacity: 0.85 }}>
                      {selectedRate?.carrier} {selectedRate?.service}
                    </p>
                    <p className="text-sm" style={{ opacity: 0.6 }}>
                      {formatPrice(parseFloat(selectedRate?.rate ?? "0") * 100)}
                      {selectedRate?.delivery_days != null && (
                        <span className="ml-2">· {selectedRate.delivery_days} business {selectedRate.delivery_days === 1 ? "day" : "days"}</span>
                      )}
                    </p>
                    {(insuranceRequired || signatureRequired) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {insuranceRequired && (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 10%, transparent)" }}>
                            Insured up to {formatPrice(Math.min(subtotal, EASYPOST_MAX_INSURABLE_VALUE) * 100)} (+{formatPrice(insuranceFee * 100)})
                          </span>
                        )}
                        {signatureRequired && (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 10%, transparent)" }}>
                            Signature required
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setStep("shipping")} className="text-xs shrink-0 transition-opacity hover:opacity-80 font-medium" style={{ opacity: 0.5 }}>
                    Edit
                  </button>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ opacity: 0.4 }}>Items</p>
                <ul className="space-y-1.5">
                  {items.map((item) => (
                    <li key={item.productId} className="flex justify-between text-sm" style={{ opacity: 0.8 }}>
                      <span>{item.name} × {item.quantity}</span>
                      <span className="font-medium">{formatPrice(item.price * item.quantity * 100)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Surcharge disclosure */}
              {surchargeConfig?.surcharge_active && surchargeConfig.surcharge_message && (
                <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 5%, var(--site-bg))", border: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)" }}>
                  <p style={{ opacity: 0.7 }}>{surchargeConfig.surcharge_message}</p>
                </div>
              )}

              {error && <p className="text-sm text-red-400 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>{error}</p>}

              <button onClick={preparePayment} disabled={loading}
                className="w-full rounded-lg py-4 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 flex items-center justify-center gap-2"
                style={btnPrimaryStyle}>
                {loading ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Preparing payment…
                  </>
                ) : (
                  <>
                    <Lock className="h-3.5 w-3.5" />
                    Continue to Payment
                  </>
                )}
              </button>

              {checkoutConfig?.restocking_fee_active && checkoutConfig.restocking_fee_disclaimer && (
                <p className="text-xs text-center leading-relaxed" style={{ opacity: 0.55 }}>
                  {checkoutConfig.restocking_fee_disclaimer}
                </p>
              )}
            </div>
          )}

          {/* Step 3: Payment */}
          {step === "payment" && clientSecret && orderIdForPayment && (
            <div className="rounded-xl p-6" style={panelStyle}>
              <h2 className="text-base font-semibold mb-5">Payment Details</h2>
              <Elements
                stripe={stripePromise}
                options={{ clientSecret, appearance: stripeAppearance }}
              >
                <PaymentForm
                  clientSecret={clientSecret}
                  orderId={orderIdForPayment}
                  baseTotal={baseTotal}
                  surchargeConfig={surchargeConfig}
                  shippingCountry={address.country}
                  shippingZip={address.zip}
                  onBack={goBackFromPayment}
                />
              </Elements>
            </div>
          )}

        </div>

        {/* ── Right column: order summary sidebar ──────────────────────── */}
        <div className="lg:w-72 shrink-0">
          <div className="rounded-xl p-5 lg:sticky lg:top-24 space-y-3" style={panelStyle}>
            <h3 className="font-semibold text-sm">Order Summary</h3>

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between" style={{ opacity: 0.7 }}>
                <span>Subtotal</span>
                <span>{formatPrice(subtotal * 100)}</span>
              </div>

              {d && d.discountAmount > 0 && (
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>Promo ({appliedPromo!.code})</span>
                  <span>-{formatPrice(d.discountAmount * 100)}</span>
                </div>
              )}

              {selectedRate && (
                <div className="flex justify-between" style={d?.shippingDiscount ? {} : { opacity: 0.7 }}>
                  <span>
                    Shipping
                    {d?.shippingDiscount ? <span className="ml-1 text-xs text-green-600 dark:text-green-400">({appliedPromo!.code})</span> : null}
                  </span>
                  {shippingDiscountApplied > 0
                    ? <span>
                        <span style={{ opacity: 0.45 }}>{formatPrice(rawBaseShipping * 100)}</span>
                        {" "}<span className="text-green-600 dark:text-green-400">-{formatPrice(shippingDiscountApplied * 100)}</span>
                        {" = "}
                        {displayBaseShipping === 0
                          ? <span className="text-green-600 dark:text-green-400 font-medium">FREE</span>
                          : <span className="font-medium">{formatPrice(displayBaseShipping * 100)}</span>
                        }
                      </span>
                    : <span style={{ opacity: 0.7 }}>{formatPrice(displayBaseShipping * 100)}</span>
                  }
                </div>
              )}

              {insuranceFee > 0 && (
                <div className="flex justify-between" style={d?.shippingDiscount ? {} : { opacity: 0.7 }}>
                  <span>Insurance (1%)</span>
                  {insuranceDiscountApplied > 0
                    ? <span>
                        <span style={{ opacity: 0.45 }}>{formatPrice(insuranceFee * 100)}</span>
                        {" "}<span className="text-green-600 dark:text-green-400">-{formatPrice(insuranceDiscountApplied * 100)}</span>
                        {" = "}
                        {displayInsurance === 0
                          ? <span className="text-green-600 dark:text-green-400 font-medium">FREE</span>
                          : <span className="font-medium">{formatPrice(displayInsurance * 100)}</span>
                        }
                      </span>
                    : <span style={{ opacity: 0.7 }}>{formatPrice(displayInsurance * 100)}</span>
                  }
                </div>
              )}

              {/* Show estimated surcharge in review step; hide in payment step (actual surcharge applied after card detection) */}
              {step !== "payment" && estimatedSurcharge > 0 && (
                <div className="flex justify-between" style={{ opacity: 0.7 }}>
                  <span>Surcharge ({surchargePercent}%)</span>
                  <span>{formatPrice(estimatedSurcharge * 100)}</span>
                </div>
              )}

              {step === "payment" && surchargeConfig?.surcharge_active && estimatedSurcharge > 0 && (
                <div className="text-xs" style={{ opacity: 0.5 }}>
                  Credit card surcharge may apply
                </div>
              )}

              <div className="flex justify-between font-semibold text-base pt-2" style={dividerStyle}>
                <span>Total</span>
                <span>
                  {step === "payment"
                    ? formatPrice(Math.round(baseTotal * 100))
                    : formatPrice(Math.max(0, effectiveTotal) * 100)
                  }
                </span>
              </div>
            </div>

            {/* Promo code — hide on payment step */}
            {step !== "payment" && (
              <div className="pt-2" style={dividerStyle}>
                {appliedPromo ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                      ✓ {appliedPromo.code} applied
                    </span>
                    <button
                      onClick={handleRemovePromo}
                      disabled={promoLoading}
                      className="flex items-center gap-0.5 text-xs opacity-45 hover:opacity-100 transition-opacity"
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
                        onChange={(e) => { setPromoInput(e.target.value.toUpperCase()); setPromoError(null); }}
                        onKeyDown={(e) => e.key === "Enter" && handleApplyPromo()}
                        placeholder="Promo code"
                        className="flex-1 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-current"
                        style={inputStyle}
                      />
                      <button
                        onClick={handleApplyPromo}
                        disabled={promoLoading || !promoInput.trim()}
                        className="rounded-md px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-80 disabled:opacity-40 flex items-center gap-1"
                        style={btnPrimaryStyle}
                      >
                        {promoLoading ? <Spinner className="h-3 w-3" /> : "Apply"}
                      </button>
                    </div>
                    {promoError && <p className="text-xs text-red-400">{promoError}</p>}
                  </div>
                )}
              </div>
            )}

            {/* Items list */}
            {items.length > 0 && (
              <div className="pt-2 space-y-2" style={dividerStyle}>
                {items.map((item) => (
                  <div key={item.productId} className="flex gap-3 items-start">
                    {item.image && (
                      <div className="h-10 w-10 shrink-0 rounded-md overflow-hidden bg-gray-100" style={{ backgroundImage: `url(${item.image})`, backgroundSize: "cover", backgroundPosition: "center" }} />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium leading-tight truncate" style={{ opacity: 0.8 }}>{item.name}</p>
                      <p className="text-xs" style={{ opacity: 0.45 }}>Qty {item.quantity} · {formatPrice(item.price * 100)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
