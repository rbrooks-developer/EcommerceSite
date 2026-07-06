"use client";

import { useActionState } from "react";
import { saveCustomsSettings } from "@/lib/actions/settings";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type TariffCode = { id: string; hs_tariff_number: string; description: string };

export function CustomsSettingsForm({
  defaultHsTariffNumber,
  tariffCodes = [],
}: {
  defaultHsTariffNumber: string;
  tariffCodes?: TariffCode[];
}) {
  const [state, formAction, isPending] = useActionState(saveCustomsSettings, null);

  return (
    <form action={formAction} className="space-y-6">
      {state?.error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {state.error}
        </div>
      )}
      {state?.success && (
        <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm text-green-700">
          Customs settings saved.
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Default Tariff Code</h2>

        <div>
          <Label htmlFor="default_hs_tariff_number">Default HS Tariff Number</Label>
          <input
            id="default_hs_tariff_number"
            name="default_hs_tariff_number"
            list="tariff-codes-list-default"
            defaultValue={defaultHsTariffNumber}
            placeholder={tariffCodes.length > 0 ? "Pick from library or type a code…" : "e.g. 9705.00.0000"}
            maxLength={20}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          {tariffCodes.length > 0 && (
            <datalist id="tariff-codes-list-default">
              {tariffCodes.map((tc) => (
                <option key={tc.id} value={tc.hs_tariff_number}>{tc.description}</option>
              ))}
            </datalist>
          )}
          <p className="mt-1.5 text-xs text-gray-500">
            Used on international customs declarations when neither the product nor its category has an HS tariff number set.
            6–10 digit Harmonized System code.
          </p>
        </div>
      </div>

      <Button type="submit" loading={isPending}>Save Customs Settings</Button>
    </form>
  );
}
