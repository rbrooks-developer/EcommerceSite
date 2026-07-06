"use client";

import { useActionState } from "react";
import { saveCustomsSettings } from "@/lib/actions/settings";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function CustomsSettingsForm({ defaultHsTariffNumber }: { defaultHsTariffNumber: string }) {
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
          <Input
            id="default_hs_tariff_number"
            name="default_hs_tariff_number"
            defaultValue={defaultHsTariffNumber}
            placeholder="e.g. 9705.00.0000"
            maxLength={20}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Used on international customs declarations when a category does not have its own HS tariff number set.
            6–10 digit Harmonized System code.
          </p>
        </div>
      </div>

      <Button type="submit" loading={isPending}>Save Customs Settings</Button>
    </form>
  );
}
