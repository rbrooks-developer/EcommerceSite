"use client";

import { useActionState, useEffect, useState } from "react";
import { saveAddress } from "@/lib/actions/addresses";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Package, CreditCard } from "lucide-react";
import { SUBDIVISIONS, getSubdivisionLabel } from "@/lib/data/countries";
import type { Country } from "@/lib/data/countries";
import type { UserAddress } from "@/types";

interface AddressFormProps {
  address?: UserAddress | null;
  allowedCountries: Country[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AddressForm({ address, allowedCountries, onClose, onSuccess }: AddressFormProps) {
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
      "flex h-11 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent",
      hasError && "border-red-500 focus:ring-red-500"
    );

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        {address ? "Edit Address" : "Add New Address"}
      </h3>

      <form action={action} className="space-y-4">
        {address && <input type="hidden" name="address_id" value={address.id} />}

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

          {/* Hidden state field for countries without subdivisions */}
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

        <div className="space-y-2 pt-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Set as default</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="is_default_shipping"
              defaultChecked={address?.is_default_shipping ?? false}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="flex items-center gap-1.5 text-gray-700">
              <Package className="h-3.5 w-3.5 text-blue-500" /> Default shipping address
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              name="is_default_billing"
              defaultChecked={address?.is_default_billing ?? false}
              className="h-4 w-4 rounded border-gray-300"
            />
            <span className="flex items-center gap-1.5 text-gray-700">
              <CreditCard className="h-3.5 w-3.5 text-purple-500" /> Default billing address
            </span>
          </label>
        </div>

        <div className="flex gap-3 pt-1">
          <Button type="submit" loading={isPending}>
            {address ? "Save Changes" : "Add Address"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </div>
  );
}
