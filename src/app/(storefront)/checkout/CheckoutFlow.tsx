"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { validateAndSyncCart } from "@/lib/actions/cart";
import { formatPrice } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { SUBDIVISIONS, getSubdivisionLabel, getCountryName } from "@/lib/data/countries";
import type { Country } from "@/lib/data/countries";
import type { EasyPostRate, ShippingAddress, UserAddress } from "@/types";
import { EASYPOST_MAX_INSURABLE_VALUE } from "@/lib/easypost/protection";

type Step = "address" | "shipping" | "review";

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

export function CheckoutFlow({ allowedCountries, defaultShipping }: { allowedCountries: Country[]; defaultShipping: UserAddress | null }) {
  const router = useRouter();
  const { items, subtotal, clearCart, reloadCart } = useCart();

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
  const [signatureRequired, setSignatureRequired] = useState(false);
  const [insuranceFee, setInsuranceFee] = useState(0);

  const subdivisions = SUBDIVISIONS[address.country] ?? [];
  const hasSubdivisions = subdivisions.length > 0;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="mb-6" style={{ opacity: 0.5 }}>Your cart is empty.</p>
        <button onClick={() => router.push("/products")}
          className="rounded-md px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
          style={btnPrimaryStyle}>
          Browse Products
        </button>
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
      const sorted = [...(data.rates as EasyPostRate[])].sort(
        (a, b) => parseFloat(a.rate) - parseFloat(b.rate)
      );
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

  async function startPayment() {
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
      const res = await fetch("/api/checkout/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, offerId: i.offerId ?? null })),
          shippingAddress: address,
          shippingRate: selectedRate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  const shippingCost = selectedRate ? parseFloat(selectedRate.rate) : 0;

  const addressSummary = [
    address.address_line1,
    address.city,
    [address.state, address.zip].filter(Boolean).join(" "),
    address.country !== defaultCountry ? getCountryName(address.country) : null,
  ].filter(Boolean).join(", ");

  const dividerStyle: React.CSSProperties = { borderTop: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)" };

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-2">Checkout</h1>

      {/* Step breadcrumb */}
      <div className="flex items-center gap-2 text-sm mb-8">
        {(["address", "review"] as const).map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            {i > 0 && <span style={{ opacity: 0.3 }}>›</span>}
            <span
              className={step === s || (s === "review" && step === "shipping") ? "font-semibold" : ""}
              style={step === s || (s === "review" && step === "shipping") ? {} : { opacity: 0.4 }}
            >
              {s === "address" ? "Address" : "Review"}
            </span>
          </span>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1">

          {/* Step 1: Address */}
          {step === "address" && (
            <div className="rounded-lg p-6 space-y-4" style={panelStyle}>
              <h2 className="font-semibold">Shipping Address</h2>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ opacity: 0.75 }}>Full Name</label>
                <input value={address.name} onChange={(e) => setAddress((a) => ({ ...a, name: e.target.value }))}
                  placeholder="Jane Smith" autoComplete="name"
                  className={inputClass} style={fieldErrors.name ? inputErrorStyle : inputStyle} />
                {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ opacity: 0.75 }}>Country</label>
                <select value={address.country}
                  onChange={(e) => setAddress((a) => ({ ...a, country: e.target.value, state: "" }))}
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
                  <label className="block text-sm font-medium mb-1" style={{ opacity: 0.75 }}>{label}</label>
                  <input type="text" value={address[key] ?? ""}
                    onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
                    placeholder={placeholder} autoComplete={autoComplete}
                    className={inputClass} style={fieldErrors[key] ? inputErrorStyle : inputStyle} />
                  {fieldErrors[key] && <p className="mt-1 text-xs text-red-400">{fieldErrors[key]}</p>}
                </div>
              ))}

              <div className={`grid gap-4 ${hasSubdivisions ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
                <div className={hasSubdivisions ? "col-span-2 sm:col-span-1" : ""}>
                  <label className="block text-sm font-medium mb-1" style={{ opacity: 0.75 }}>City</label>
                  <input value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))}
                    autoComplete="address-level2"
                    className={inputClass} style={fieldErrors.city ? inputErrorStyle : inputStyle} />
                  {fieldErrors.city && <p className="mt-1 text-xs text-red-400">{fieldErrors.city}</p>}
                </div>

                {hasSubdivisions && (
                  <div>
                    <label className="block text-sm font-medium mb-1" style={{ opacity: 0.75 }}>
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
                  <label className="block text-sm font-medium mb-1" style={{ opacity: 0.75 }}>
                    {address.country === "GB" ? "Postcode" : "ZIP / Postal Code"}
                  </label>
                  <input value={address.zip} onChange={(e) => setAddress((a) => ({ ...a, zip: e.target.value }))}
                    autoComplete="postal-code"
                    className={inputClass} style={fieldErrors.zip ? inputErrorStyle : inputStyle} />
                  {fieldErrors.zip && <p className="mt-1 text-xs text-red-400">{fieldErrors.zip}</p>}
                </div>
              </div>

              {error && <p className="text-sm text-red-400 rounded-md px-3 py-2" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>{error}</p>}

              <button onClick={fetchRates} disabled={loading}
                className="w-full rounded-md py-3.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-60 flex items-center justify-center gap-2"
                style={btnPrimaryStyle}>
                {loading && <Spinner className="h-4 w-4" />}
                {loading ? "Getting rates…" : "Continue to Shipping"}
              </button>
            </div>
          )}

          {/* Step 2: Shipping rates (only shown when user clicks Edit on shipping method) */}
          {step === "shipping" && (
            <div className="rounded-lg p-6 space-y-4" style={panelStyle}>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Change Shipping Method</h2>
                <button onClick={() => setStep("review")} className="text-xs transition-opacity hover:opacity-60" style={{ opacity: 0.45 }}>← Back to review</button>
              </div>
              <p className="text-sm" style={{ opacity: 0.55 }}>{address.name} · {addressSummary}</p>
              {rates.length === 0 ? (
                <p className="text-sm" style={{ opacity: 0.4 }}>No rates available for this address.</p>
              ) : (
                <div className="space-y-2">
                  {rates.map((rate) => (
                    <label key={rate.id}
                      className="flex items-center gap-3 rounded-md p-3.5 cursor-pointer transition-opacity"
                      style={selectedRate?.id === rate.id
                        ? { border: "1px solid var(--site-fg)", backgroundColor: "color-mix(in srgb, var(--site-fg) 10%, var(--site-bg))" }
                        : { border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)" }
                      }>
                      <input type="radio" name="shipping_rate" value={rate.id}
                        checked={selectedRate?.id === rate.id} onChange={() => setSelectedRate(rate)} className="shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{rate.carrier} {rate.service}</p>
                        {rate.delivery_days != null && (
                          <p className="text-xs" style={{ opacity: 0.45 }}>{rate.delivery_days} business {rate.delivery_days === 1 ? "day" : "days"}</p>
                        )}
                      </div>
                      <span className="font-semibold text-sm">{formatPrice(parseFloat(rate.rate) * 100)}</span>
                    </label>
                  ))}
                </div>
              )}
              <button onClick={() => setStep("review")} disabled={!selectedRate}
                className="w-full rounded-md py-3.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
                style={btnPrimaryStyle}>
                Continue to Review
              </button>
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && (
            <div className="rounded-lg p-6 space-y-5" style={panelStyle}>
              <h2 className="font-semibold">Review Your Order</h2>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ opacity: 0.45 }}>Shipping to</p>
                <p className="text-sm" style={{ opacity: 0.8 }}>
                  {address.name}<br />
                  {address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}<br />
                  {address.city}{address.state ? `, ${address.state}` : ""} {address.zip}
                  {address.country !== defaultCountry && <><br />{getCountryName(address.country)}</>}
                </p>
                <button onClick={() => setStep("address")} className="mt-1 text-xs transition-opacity hover:opacity-60" style={{ opacity: 0.5 }}>Edit</button>
              </div>
              <div style={dividerStyle} className="pt-4">
                <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ opacity: 0.45 }}>Shipping method</p>
                <p className="text-sm" style={{ opacity: 0.8 }}>
                  {selectedRate?.carrier} {selectedRate?.service} — {formatPrice(parseFloat(selectedRate?.rate ?? "0") * 100)}
                </p>
                {(insuranceRequired || signatureRequired) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {insuranceRequired && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 12%, transparent)" }}>
                        Insured up to {formatPrice(Math.min(subtotal, EASYPOST_MAX_INSURABLE_VALUE) * 100)} (+{formatPrice(insuranceFee * 100)})
                      </span>
                    )}
                    {signatureRequired && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 12%, transparent)" }}>
                        Signature required
                      </span>
                    )}
                  </div>
                )}
                <button onClick={() => setStep("shipping")} className="mt-1 text-xs transition-opacity hover:opacity-60" style={{ opacity: 0.5 }}>Edit</button>
              </div>
              <div style={dividerStyle} className="pt-4">
                <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ opacity: 0.45 }}>Items</p>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.productId} className="flex justify-between text-sm" style={{ opacity: 0.8 }}>
                      <span>{item.name} × {item.quantity}</span>
                      <span>{formatPrice(item.price * item.quantity * 100)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {error && <p className="text-sm text-red-400 rounded-md px-3 py-2" style={{ backgroundColor: "rgba(239,68,68,0.1)" }}>{error}</p>}
              <button onClick={startPayment} disabled={loading}
                className="w-full rounded-md py-3.5 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-60 flex items-center justify-center gap-2"
                style={btnPrimaryStyle}>
                {loading && <Spinner className="h-4 w-4" />}
                {loading ? "Redirecting to payment…" : "Pay Now"}
              </button>
              <p className="text-xs text-center" style={{ opacity: 0.4 }}>You'll be redirected to Stripe's secure payment page.</p>
            </div>
          )}
        </div>

        {/* Order summary sidebar */}
        <div className="lg:w-72 shrink-0">
          <div className="rounded-lg p-5 sticky top-24 space-y-3" style={panelStyle}>
            <h3 className="font-semibold text-sm">Order Summary</h3>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between" style={{ opacity: 0.7 }}><span>Subtotal</span><span>{formatPrice(subtotal * 100)}</span></div>
              {selectedRate && (
                <div className="flex justify-between" style={{ opacity: 0.7 }}>
                  <span>Shipping</span><span>{formatPrice((parseFloat(selectedRate.rate) - insuranceFee) * 100)}</span>
                </div>
              )}
              {insuranceFee > 0 && (
                <div className="flex justify-between" style={{ opacity: 0.7 }}>
                  <span>Insurance (1%)</span><span>{formatPrice(insuranceFee * 100)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold pt-1" style={dividerStyle}>
                <span>Total</span><span>{formatPrice((subtotal + shippingCost) * 100)}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
