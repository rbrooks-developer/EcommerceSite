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
import { X, Lock, ShieldCheck, Tag, Truck, CreditCard, MapPin } from "lucide-react";
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

// ── Shared styles ──────────────────────────────────────────────────────────────

const fg = "var(--site-fg)";
const bg = "var(--site-bg)";
const mix = (p: number) => `color-mix(in srgb, ${fg} ${p}%, ${bg})`;
const mixT = (p: number) => `color-mix(in srgb, ${fg} ${p}%, transparent)`;

const inputStyle: React.CSSProperties = { backgroundColor: mix(5), color: fg, border: `1px solid ${mixT(18)}` };
const inputErrStyle: React.CSSProperties = { ...inputStyle, border: "1px solid rgb(248 113 113)" };
const btnPrimary: React.CSSProperties = { backgroundColor: fg, color: bg };
const cardStyle: React.CSSProperties = { backgroundColor: mix(4), border: `1px solid ${mixT(12)}`, borderRadius: "14px", position: "relative", zIndex: 46 };
const rowStyle: React.CSSProperties = { backgroundColor: mix(6), border: `1px solid ${mixT(10)}`, borderRadius: "10px" };
const divider = `1px solid ${mixT(10)}`;
const inputCls = "w-full rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-current transition-colors";

const EMPTY_ADDRESS: ShippingAddress = { name: "", address_line1: "", address_line2: "", city: "", state: "", zip: "", country: "US" };

// ── Address field block (reusable) ─────────────────────────────────────────────

function AddressFields({
  value,
  onChange,
  errors,
  allowedCountries,
  nameLabel = "Full Name",
  showName = true,
}: {
  value: ShippingAddress;
  onChange: (a: ShippingAddress) => void;
  errors: Partial<Record<keyof ShippingAddress, string>>;
  allowedCountries: Country[];
  nameLabel?: string;
  showName?: boolean;
}) {
  const subdivisions = SUBDIVISIONS[value.country] ?? [];
  const hasSubdivisions = subdivisions.length > 0;

  return (
    <div className="space-y-3">
      {showName && (
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ opacity: 0.55 }}>{nameLabel}</label>
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
  surchargeConfig?: SurchargeConfig | null;
  billingAddress: ShippingAddress;
  onPaymentTypeChange: (type: string) => void;
  onSurchargeApplied: (s: { amount: number; percent: number } | null) => void;
}

function PaymentForm({
  clientSecret, orderId, baseTotal, surchargeConfig,
  billingAddress, onPaymentTypeChange, onSurchargeApplied,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surcharge, setSurcharge] = useState<{ amount: number; percent: number } | null>(null);
  const [hasExpress, setHasExpress] = useState(false);
  const [selectedType, setSelectedType] = useState("card");

  const displayTotal = surcharge ? baseTotal + surcharge.amount : baseTotal;
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
          layout: "tabs",
          fields: {
            billingDetails: {
              name: "never",
              address: "never",
            },
          },
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

  const makeAddr = (u: UserAddress | null): ShippingAddress => u ? {
    name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
    address_line1: u.address_line1 ?? "",
    address_line2: u.address_line2 ?? "",
    city: u.city ?? "",
    state: u.state ?? "",
    zip: u.zip ?? "",
    country: u.country ?? defaultCountry,
  } : { ...EMPTY_ADDRESS, country: defaultCountry };

  const [address, setAddress] = useState<ShippingAddress>(makeAddr(defaultShipping));
  const [addrErrors, setAddrErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});

  // Billing address — default to profile billing if exists, else "same as shipping"
  const [sameAsShipping, setSameAsShipping] = useState(!defaultBilling);
  const [billingAddress, setBillingAddress] = useState<ShippingAddress>(
    defaultBilling ? makeAddr(defaultBilling) : makeAddr(defaultShipping)
  );
  const [billErrors, setBillErrors] = useState<Partial<Record<keyof ShippingAddress, string>>>({});

  const effectiveBilling: ShippingAddress = sameAsShipping ? address : billingAddress;

  const [rates, setRates] = useState<EasyPostRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<EasyPostRate | null>(null);
  const [insuranceFee, setInsuranceFee] = useState(0);
  const [insuranceRequired, setInsuranceRequired] = useState(false);
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [ratesLoaded, setRatesLoaded] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [ratesError, setRatesError] = useState<string | null>(null);

  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(initialPromo ?? null);
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderIdForPayment, setOrderIdForPayment] = useState<string | null>(null);
  const [baseTotal, setBaseTotal] = useState(0);
  const [selectedPaymentType, setSelectedPaymentType] = useState("card");
  const [actualSurcharge, setActualSurcharge] = useState<{ amount: number; percent: number } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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

  let estimatedSurcharge = 0;
  let surchargePercent = 0;
  if (selectedPaymentType === "card" && surchargeConfig?.surcharge_active && (surchargeConfig.surcharge_percent ?? 0) > 0 && selectedRate && !actualSurcharge) {
    const minOrder = surchargeConfig.surcharge_min_order ?? 0;
    if (minOrder === 0 || discountedSubtotal >= minOrder) {
      surchargePercent = Math.min(surchargeConfig.surcharge_percent, 4);
      estimatedSurcharge = Math.round(discountedSubtotal * surchargePercent / 100 * 100) / 100;
    }
  }

  const effectiveTotal = discountedSubtotal + displayBaseShipping + displayInsurance;
  const displayedTotal = clientSecret
    ? baseTotal + (actualSurcharge?.amount ?? 0)
    : effectiveTotal + estimatedSurcharge;

  // ── Validation ───────────────────────────────────────────────────────────────

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

  // ── Actions ──────────────────────────────────────────────────────────────────

  async function fetchRates() {
    if (!validateAddr(address, setAddrErrors)) return;
    if (!sameAsShipping && !validateAddr(billingAddress, setBillErrors)) return;
    setRatesLoading(true);
    setRatesError(null);
    setRatesLoaded(false);
    setRates([]);
    setSelectedRate(null);
    setClientSecret(null);
    setOrderIdForPayment(null);
    setBaseTotal(0);
    setActualSurcharge(null);
    try {
      const { valid, issues } = await validateAndSyncCart();
      if (!valid) {
        await reloadCart();
        setRatesError(issues.map(i =>
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
      if (!res.ok) throw new Error(data.error ?? "Failed to fetch shipping rates");
      const sorted = [...(data.rates as EasyPostRate[])].sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
      setRates(sorted);
      setSelectedRate(sorted[0] ?? null);
      setInsuranceRequired(!!data.insuranceRequired);
      setSignatureRequired(!!data.signatureRequired);
      setInsuranceFee(parseFloat(data.insuranceFee ?? "0"));
      setRatesLoaded(true);
      if (sorted[0]) await initPayment(sorted[0]);
    } catch (err: any) {
      setRatesError(err.message);
    } finally {
      setRatesLoading(false);
    }
  }

  async function handleSelectRate(rate: EasyPostRate) {
    setSelectedRate(rate);
    setClientSecret(null);
    setOrderIdForPayment(null);
    setBaseTotal(0);
    setActualSurcharge(null);
    setPaymentError(null);
    await initPayment(rate);
  }

  async function initPayment(rate: EasyPostRate) {
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const { valid, issues } = await validateAndSyncCart();
      if (!valid) {
        await reloadCart();
        setPaymentError(issues.map(i =>
          i.issue === "removed" ? `"${i.name}" is no longer available.` : `"${i.name}" reduced to qty ${i.newQuantity}.`
        ).join(" "));
        return;
      }
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
      if (!res.ok) throw new Error(data.error ?? "Failed to prepare payment");
      setClientSecret(data.clientSecret);
      setOrderIdForPayment(data.orderId);
      setBaseTotal(data.totalPrice);
    } catch (err: any) {
      setPaymentError(err.message);
    } finally {
      setPaymentLoading(false);
    }
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen" style={{ backgroundColor: bg }}>
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8 lg:py-10">

        <div className="flex items-center gap-2.5 mb-8">
          <Lock className="h-4 w-4" style={{ opacity: 0.35 }} />
          <h1 className="text-xl font-bold tracking-tight">Secure Checkout</h1>
        </div>

        <div className="flex flex-col lg:flex-row gap-5 lg:gap-8 items-start">

          {/* ── Left column ─────────────────────────────────────────── */}
          <div className="w-full lg:flex-1 min-w-0 space-y-5">

            {/* Shipping Address */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4">
                <Truck className="h-4 w-4" style={{ opacity: 0.5 }} />
                <h2 className="font-bold text-sm tracking-wide">Shipping Address</h2>
              </div>
              <div className="px-5 pb-5" style={{ borderTop: divider, paddingTop: "16px" }}>
                <AddressFields
                  value={address}
                  onChange={a => {
                    setAddress(a);
                    if (appliedPromo?.discount_type === "free_shipping" && !appliedPromo.allow_international && a.country !== "US") {
                      removePromoCode().then(() => { setAppliedPromo(null); setPromoError("Promo removed — not valid for international orders."); });
                    }
                    if (sameAsShipping) setBillingAddress(a);
                  }}
                  errors={addrErrors}
                  allowedCountries={allowedCountries}
                />

                {ratesError && (
                  <p className="mt-3 text-sm text-red-400 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {ratesError}
                  </p>
                )}

                <button onClick={fetchRates} disabled={ratesLoading}
                  className="w-full rounded-xl py-3.5 text-sm font-bold tracking-wide mt-4 transition-opacity hover:opacity-85 disabled:opacity-40 flex items-center justify-center gap-2"
                  style={btnPrimary}>
                  {ratesLoading ? <><Spinner className="h-4 w-4" /> Getting rates…</> : ratesLoaded ? "Refresh Rates" : "Get Shipping Rates"}
                </button>
              </div>
            </div>

            {/* Billing Address */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4">
                <MapPin className="h-4 w-4" style={{ opacity: 0.5 }} />
                <h2 className="font-bold text-sm tracking-wide">Billing Address</h2>
              </div>
              <div className="px-5 pb-5 space-y-3" style={{ borderTop: divider, paddingTop: "16px" }}>
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
                  <div className="rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={{ backgroundColor: mix(6), opacity: 0.65 }}>
                    {address.name && <span>{address.name}, </span>}
                    {address.address_line1}
                    {address.address_line2 ? `, ${address.address_line2}` : ""},&nbsp;
                    {address.city}{address.state ? `, ${address.state}` : ""} {address.zip}
                    {address.country !== (allowedCountries[0]?.code ?? "US") ? `, ${getCountryName(address.country)}` : ""}
                  </div>
                )}
              </div>
            </div>

            {/* Shipping Method */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4">
                <Truck className="h-4 w-4" style={{ opacity: 0.5 }} />
                <h2 className="font-bold text-sm tracking-wide">Shipping Method</h2>
              </div>
              <div className="px-5 pb-5 space-y-3" style={{ borderTop: divider, paddingTop: "16px" }}>
                {!ratesLoaded && !ratesLoading && (
                  <div className="rounded-xl py-8 text-center" style={rowStyle}>
                    <Truck className="h-6 w-6 mx-auto mb-2" style={{ opacity: 0.2 }} />
                    <p className="text-sm" style={{ opacity: 0.4 }}>Enter your shipping address above to see rates</p>
                  </div>
                )}

                {ratesLoading && (
                  <div className="rounded-xl py-8 flex items-center justify-center gap-2" style={rowStyle}>
                    <span style={{ opacity: 0.4 }}><Spinner className="h-4 w-4" /></span>
                    <span className="text-sm" style={{ opacity: 0.4 }}>Fetching rates…</span>
                  </div>
                )}

                {ratesLoaded && rates.length === 0 && (
                  <p className="text-sm text-center py-4" style={{ opacity: 0.4 }}>No rates available for this address.</p>
                )}

                {ratesLoaded && rates.map(rate => (
                  <label key={rate.id}
                    className="flex items-center gap-3 rounded-xl p-3.5 cursor-pointer transition-all"
                    style={selectedRate?.id === rate.id
                      ? { border: `1.5px solid ${fg}`, backgroundColor: mix(7) }
                      : rowStyle
                    }>
                    <input type="radio" name="shipping_rate" value={rate.id}
                      checked={selectedRate?.id === rate.id}
                      onChange={() => handleSelectRate(rate)}
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
            </div>

            {/* Payment */}
            <div style={cardStyle} className="overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4">
                <CreditCard className="h-4 w-4" style={{ opacity: 0.5 }} />
                <h2 className="font-bold text-sm tracking-wide">Payment</h2>
              </div>
              <div className="px-5 pb-5 space-y-4" style={{ borderTop: divider, paddingTop: "16px" }}>
                {!ratesLoaded && !paymentLoading && !clientSecret && (
                  <div className="rounded-xl py-8 text-center" style={rowStyle}>
                    <CreditCard className="h-6 w-6 mx-auto mb-2" style={{ opacity: 0.2 }} />
                    <p className="text-sm" style={{ opacity: 0.4 }}>Select a shipping method above to continue</p>
                  </div>
                )}

                {paymentLoading && (
                  <div className="rounded-xl py-8 flex items-center justify-center gap-2" style={rowStyle}>
                    <span style={{ opacity: 0.4 }}><Spinner className="h-4 w-4" /></span>
                    <span className="text-sm" style={{ opacity: 0.4 }}>Preparing payment…</span>
                  </div>
                )}

                {paymentError && (
                  <p className="text-sm text-red-400 rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                    {paymentError}
                  </p>
                )}

                {clientSecret && orderIdForPayment && (
                  <>
                    {checkoutConfig?.restocking_fee_active && checkoutConfig.restocking_fee_disclaimer && (
                      <p className="text-xs leading-relaxed" style={{ opacity: 0.45 }}>
                        {checkoutConfig.restocking_fee_disclaimer}
                      </p>
                    )}
                    <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
                      <PaymentForm
                        clientSecret={clientSecret}
                        orderId={orderIdForPayment}
                        baseTotal={baseTotal}
                        surchargeConfig={surchargeConfig}
                        billingAddress={effectiveBilling}
                        onPaymentTypeChange={setSelectedPaymentType}
                        onSurchargeApplied={setActualSurcharge}
                      />
                    </Elements>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* ── Right column: Order Summary ──────────────────────────── */}
          <div className="w-full lg:w-72 xl:w-80 shrink-0 lg:sticky lg:top-6">
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

              {/* Promo code */}
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
                    <span>{displayInsurance === 0 ? <span className="text-green-600 dark:text-green-400 font-medium">FREE</span> : formatPrice(displayInsurance * 100)}</span>
                  </div>
                )}

                {actualSurcharge ? (
                  <div className="flex justify-between text-sm text-green-700 dark:text-green-400">
                    <span>Credit card surcharge ({actualSurcharge.percent}%)</span>
                    <span>+{formatPrice(actualSurcharge.amount * 100)}</span>
                  </div>
                ) : estimatedSurcharge > 0 && clientSecret ? (
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
          </div>

        </div>
      </div>
    </div>
  );
}
