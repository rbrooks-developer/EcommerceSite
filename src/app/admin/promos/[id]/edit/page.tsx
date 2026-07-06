import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PromoForm } from "../../PromoForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Edit Promo" };

export default async function EditPromoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createServiceClient();
  const { data } = await sb
    .from("promos")
    .select("id, code, description, enabled, discount_type, discount_value, max_shipping_discount, start_date, expiration_date, minimum_order, maximum_order, max_uses, max_uses_per_customer")
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50 mb-6">Edit Promo Code</h1>
      <PromoForm promo={data as any} />
    </div>
  );
}
