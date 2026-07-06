import { getSettings } from "@/lib/data/settings";
import { createClient } from "@/lib/supabase/server";
import { CustomsSettingsForm } from "./CustomsSettingsForm";
import { TariffCodesGrid } from "./TariffCodesGrid";

export default async function CustomsPage() {
  const [settings, supabase] = await Promise.all([getSettings(), createClient()]);
  const defaultHsTariffNumber = (settings as any)?.default_hs_tariff_number ?? "";

  const { data: tariffCodes } = await supabase
    .from("tariff_codes")
    .select("id, hs_tariff_number, description")
    .order("hs_tariff_number");

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customs</h1>
        <p className="mt-1 text-sm text-gray-500">Settings and tariff codes for international shipment customs declarations.</p>
      </div>

      <CustomsSettingsForm defaultHsTariffNumber={defaultHsTariffNumber} tariffCodes={tariffCodes ?? []} />

      <TariffCodesGrid codes={tariffCodes ?? []} />
    </div>
  );
}
