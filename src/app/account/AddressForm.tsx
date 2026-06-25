"use client";

import { useActionState, useEffect, useState } from "react";
import { saveAddress } from "@/lib/actions/addresses";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SUBDIVISIONS, getSubdivisionLabel } from "@/lib/data/countries";
import type { Country } from "@/lib/data/countries";
import type { UserAddress } from "@/types";

interface AddressFormProps {
  address?: UserAddress | null;
  addressType: "shipping" | "billing";
  allowedCountries: Country[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AddressForm({ address, addressType, allowedCountries, onClose, onSuccess }: AddressFormProps) {
  const [state, action, isPending] = useActionState(saveAddress, null) as [
    { error?: Record<string, string[]>; success?: boolean } | null,
    (payload: FormData) => void,
    boolean
  ];
  const errors = state?.error;

  const defaultCountry = address?.country ?? allowedCountries[0]?.code ?? "US";
  const [selectedCountry, setSelectedCountry] = useState(defaultCountry);

  const subdivisions = SUBDIVISIONS[selectedCountry] ?? [];
  const hasSubdivisions = subdivisions.length > 0;
  const subdivisionLabel = getSubdivisionLabel(selectedCountry);

  useEffect(() => {
    if (state?.success) onSuccess();
  }, [state?.success, onSuccess]);

  const selectClass = (hasError?: boolean) =>
    cn(
      "flex h-11 w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent",
      hasError && "border-red-500"
    );

  const selectStyle = (hasError?: boolean): React.CSSProperties => ({
    backgroundColor: "var(--input-bg, var(--checkout-input-bg, white))",
    color: "var(--input-text, var(--site-fg, #111827))",
    borderColor: hasError ? undefined : "var(--input-border, #d1d5db)",
  });

  const typeLabel = addressType === "shipping" ? "Shipping" : "Billing";

  return (
    <div className="rounded-lg p-5" style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)", backgroundColor: "var(--checkout-section-bg, color-mix(in srgb, var(--site-fg) 5%, var(--site-bg)))" }}>
      <h3 className="text-sm font-semibold mb-4">
        {address ? `Edit ${typeLabel} Address` : `Add ${typeLabel} Address`}
      </h3>

      <form action={action} className="space-y-4">
        {address && <input type="hidden" name="address_id" value={address.id} />}
        <input type="hidden" name="address_type" value={addressType} />

        {errors?._form && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {errors._form[0]}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="first_name" required>First Name</Label>
            <Input id="first_name" name="first_name" autoComplete="given-name"
              defaultValue={address?.first_name ?? ""} error={errors?.first_name?.[0]} required />
          </div>
          <div>
            <Label htmlFor="last_name" required>Last Name</Label>
            <Input id="last_name" name="last_name" autoComplete="family-name"
              defaultValue={address?.last_name ?? ""} error={errors?.last_name?.[0]} required />
          </div>
        </div>

        <div>
          <Label htmlFor="company">Company (optional)</Label>
          <Input id="company" name="company" autoComplete="organization" defaultValue={address?.company ?? ""} />
        </div>

        <div>
          <Label htmlFor="address_country" required>Country</Label>
          <select
            id="address_country"
            name="country"
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            required
            className={selectClass()}
            style={selectStyle()}
          >
            {allowedCountries.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <Label htmlFor="address_line1" required>Street Address</Label>
          <Input id="address_line1" name="address_line1" placeholder="123 Main St"
            autoComplete="address-line1" defaultValue={address?.address_line1 ?? ""}
            error={errors?.address_line1?.[0]} required />
        </div>

        <div>
          <Label htmlFor="address_line2">Apt, suite, etc. (optional)</Label>
          <Input id="address_line2" name="address_line2" placeholder="Apt 4B"
            autoComplete="address-line2" defaultValue={address?.address_line2 ?? ""} />
        </div>

        <div className={cn("grid gap-4", hasSubdivisions ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2")}>
          <div className={hasSubdivisions ? "col-span-2 sm:col-span-1" : ""}>
            <Label htmlFor="city" required>City</Label>
            <Input id="city" name="city" autoComplete="address-level2"
              defaultValue={address?.city ?? ""} error={errors?.city?.[0]} required />
          </div>

          {hasSubdivisions && (
            <div>
              <Label htmlFor="state" required>{subdivisionLabel}</Label>
              <select
                id="state"
                name="state"
                defaultValue={address?.state ?? ""}
                required
                className={selectClass(!!errors?.state?.[0])}
                style={selectStyle(!!errors?.state?.[0])}
              >
                <option value="" disabled>Select…</option>
                {subdivisions.map((s) => (
                  <option key={s.code} value={s.code}>{s.code} — {s.name}</option>
                ))}
              </select>
              {errors?.state?.[0] && (
                <p className="mt-1 text-sm text-red-500">{errors.state[0]}</p>
              )}
            </div>
          )}

          {!hasSubdivisions && <input type="hidden" name="state" value="" />}

          <div>
            <Label htmlFor="zip" required>
              {selectedCountry === "GB" ? "Postcode" : selectedCountry === "CA" ? "Postal Code" : "ZIP / Postal Code"}
            </Label>
            <Input id="zip" name="zip" autoComplete="postal-code"
              defaultValue={address?.zip ?? ""} error={errors?.zip?.[0]} required />
          </div>
        </div>

        <div>
          <Label htmlFor="phone">Phone (optional)</Label>
          <Input id="phone" name="phone" type="tel" placeholder="(555) 123-4567"
            autoComplete="tel" defaultValue={address?.phone ?? ""} />
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={isPending}>
            {address ? "Save Changes" : `Add ${typeLabel} Address`}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
