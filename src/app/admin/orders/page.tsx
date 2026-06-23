import { createClient } from "@/lib/supabase/server";
import { OrdersTable } from "./OrdersTable";
import type { Order } from "@/types";

type OrderRow = Pick<
  Order,
  "id" | "status" | "total_price" | "shipping_name" | "created_at" | "tracking_number" | "shipping_label_url"
>;

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: raw } = await supabase
    .from("orders")
    .select("id, status, total_price, shipping_name, created_at, tracking_number, shipping_label_url")
    .order("created_at", { ascending: false });

  const orders = (raw ?? []) as OrderRow[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <span className="text-sm text-gray-400">{orders.length} total</span>
      </div>

      <OrdersTable orders={orders} />
    </div>
  );
}
