import { getSettings } from "@/lib/data/settings";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const [settings, supabase] = await Promise.all([getSettings(), createClient()]);
  const { data: products } = await supabase
    .from("products")
    .select("id, name")
    .eq("is_published", true)
    .order("name");
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("name");

  return (
    <div>
      <SettingsForm
        defaultValues={settings}
        products={products ?? []}
        categories={categories ?? []}
      />
    </div>
  );
}
