import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { OrdersTable } from "./OrdersTable";
import type { Order, CheckoutConfig } from "@/types";

type OrderRow = Pick<
  Order,
  "id" | "status" | "total_price" | "shipping_name" | "created_at" | "tracking_number" | "shipping_label_url"
>;

export default async function OrdersPage() {
  const [supabase, settings] = await Promise.all([createClient(), getSettings()]);
  const { data: raw } = await supabase
    .from("orders")
    .select("id, status, total_price, shipping_name, created_at, tracking_number, shipping_label_url")
    .neq("status", "pending")
    .order("created_at", { ascending: false });

  const orders = (raw ?? []) as OrderRow[];
  const checkoutCfg = (settings as any)?.checkout_config as CheckoutConfig | null;
  const restockingFeePercent = checkoutCfg?.restocking_fee_active ? (checkoutCfg.restocking_fee_percent ?? 0) : 0;
  const processingFeeFlat = checkoutCfg?.restocking_fee_active ? (checkoutCfg.processing_fee_flat ?? 0) : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <span className="text-sm text-gray-400">{orders.length} total</span>
      </div>

      <OrdersTable orders={orders} restockingFeePercent={restockingFeePercent} processingFeeFlat={processingFeeFlat} />
    </div>
  );
}
