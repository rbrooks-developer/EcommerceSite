"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PromoDiscountType } from "@/types/database";
import type { PromoFormData } from "@/lib/actions/promos";
import { createPromo, updatePromo } from "@/lib/actions/promos";

type Props = {
  promo?: {
    id: string;
    code: string;
    description: string | null;
    enabled: boolean;
    discount_type: PromoDiscountType;
    discount_value: number;
    max_shipping_discount: number | null;
    start_date: string | null;
    expiration_date: string | null;
    minimum_order: number | null;
    maximum_order: number | null;
    max_uses: number | null;
    max_uses_per_customer: number | null;
  };
};

function fmt(dt: string | null): string {
  if (!dt) return "";
  return dt.slice(0, 16); // datetime-local: "YYYY-MM-DDTHH:MM"
}

export function PromoForm({ promo }: Props) {
  const router = useRouter();
  const isEdit = !!promo;

  const [code, setCode] = useState(promo?.code ?? "");
  const [description, setDescription] = useState(promo?.description ?? "");
  const [enabled, setEnabled] = useState(promo?.enabled ?? true);
  const [discountType, setDiscountType] = useState<PromoDiscountType>(promo?.discount_type ?? "percentage");
  const [discountValue, setDiscountValue] = useState(String(promo?.discount_value ?? ""));
  const [maxShippingDiscount, setMaxShippingDiscount] = useState(
    promo?.max_shipping_discount != null ? String(promo.max_shipping_discount) : ""
  );
  const [startDate, setStartDate] = useState(fmt(promo?.start_date ?? null));
  const [expirationDate, setExpirationDate] = useState(fmt(promo?.expiration_date ?? null));
  const [minimumOrder, setMinimumOrder] = useState(
    promo?.minimum_order != null ? String(promo.minimum_order) : ""
  );
  const [maximumOrder, setMaximumOrder] = useState(
    promo?.maximum_order != null ? String(promo.maximum_order) : ""
  );
  const [maxUses, setMaxUses] = useState(promo?.max_uses != null ? String(promo.max_uses) : "");
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState(
    promo?.max_uses_per_customer != null ? String(promo.max_uses_per_customer) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) { setError("Code is required."); return; }
    if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) < 0) {
      setError("Discount value must be a valid number."); return;
    }
    setSaving(true);
    setError(null);

    const data: PromoFormData = {
      code,
      description,
      enabled,
      discount_type: discountType,
      discount_value: Number(discountValue),
      max_shipping_discount: maxShippingDiscount ? Number(maxShippingDiscount) : null,
      start_date: startDate ? new Date(startDate).toISOString() : null,
      expiration_date: expirationDate ? new Date(expirationDate).toISOString() : null,
      minimum_order: minimumOrder ? Number(minimumOrder) : null,
      maximum_order: maximumOrder ? Number(maximumOrder) : null,
      max_uses: maxUses ? Number(maxUses) : null,
      max_uses_per_customer: maxUsesPerCustomer ? Number(maxUsesPerCustomer) : null,
    };

    const result = isEdit
      ? await updatePromo(promo!.id, data)
      : await createPromo(data);

    if (result.error) { setError(result.error); setSaving(false); return; }
    router.push("/admin/promos");
    router.refresh();
  }

  const inputClass = "w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {error && (
        <p className="rounded-md bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Code + Enabled */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className={labelClass}>Promo Code *</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="SAVE10"
            className={inputClass}
          />
        </div>
        <label className="flex items-center gap-2 pb-2 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Active</span>
        </label>
      </div>

      {/* Description */}
      <div>
        <label className={labelClass}>Description (internal note)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="Summer sale 10% off"
        />
      </div>

      {/* Discount type */}
      <div>
        <label className={labelClass}>Discount Type *</label>
        <select
          value={discountType}
          onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}
          className={inputClass}
        >
          <option value="percentage">Percentage off subtotal</option>
          <option value="fixed">Fixed dollar amount off subtotal</option>
          <option value="free_shipping">Free / discounted shipping</option>
        </select>
      </div>

      {/* Conditional discount value */}
      {discountType !== "free_shipping" && (
        <div>
          <label className={labelClass}>
            {discountType === "percentage" ? "Percentage Off (e.g. 10 for 10%)" : "Dollar Amount Off"}
          </label>
          <input
            type="number"
            min="0"
            step={discountType === "percentage" ? "0.01" : "0.01"}
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      {discountType === "free_shipping" && (
        <div>
          <label className={labelClass}>Max Shipping Discount (leave blank for full discount)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={maxShippingDiscount}
            onChange={(e) => setMaxShippingDiscount(e.target.value)}
            className={inputClass}
            placeholder="e.g. 10.00"
          />
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Start Date (optional)</label>
          <input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Expiration Date (optional)</label>
          <input type="datetime-local" value={expirationDate} onChange={(e) => setExpirationDate(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Order limits */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Minimum Order ($)</label>
          <input type="number" min="0" step="0.01" value={minimumOrder} onChange={(e) => setMinimumOrder(e.target.value)} className={inputClass} placeholder="No minimum" />
        </div>
        <div>
          <label className={labelClass}>Maximum Order ($)</label>
          <input type="number" min="0" step="0.01" value={maximumOrder} onChange={(e) => setMaximumOrder(e.target.value)} className={inputClass} placeholder="No maximum" />
        </div>
      </div>

      {/* Usage limits */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Max Total Uses</label>
          <input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} className={inputClass} placeholder="Unlimited" />
        </div>
        <div>
          <label className={labelClass}>Max Uses Per Customer</label>
          <input type="number" min="1" value={maxUsesPerCustomer} onChange={(e) => setMaxUsesPerCustomer(e.target.value)} className={inputClass} placeholder="Unlimited" />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Promo"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/promos")}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
