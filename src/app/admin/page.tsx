import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { Package, FolderOpen, ShoppingCart, DollarSign, TrendingUp } from "lucide-react";
import type { Order, Product } from "@/types";

async function getStats() {
  const supabase = await createClient();
  const [products, categories, orders] = await Promise.all([
    supabase.from("products").select("id, is_published, price, inventory", { count: "exact" }),
    supabase.from("categories").select("id", { count: "exact" }),
    supabase.from("orders").select("id, total_price, refunded_amount, status", { count: "exact" }),
  ]);

  const orderRows = (orders.data ?? []) as Pick<Order, "id" | "total_price" | "refunded_amount" | "status">[];
  const productRows = (products.data ?? []) as Pick<Product, "id" | "is_published" | "price" | "inventory">[];

  const inventoryValue = productRows.reduce(
    (sum, p) => sum + Number(p.price) * p.inventory,
    0
  );

  const paidOrders = orderRows.filter((o) => o.status !== "cancelled" && o.status !== "pending");
  const paidOrderIds = paidOrders.map((o) => o.id);

  // Net of refunds — a full refund contributes $0, a partial refund
  // contributes only what the customer actually still paid.
  const netRevenueByOrder = Object.fromEntries(
    paidOrders.map((o) => [o.id, Math.max(0, Number(o.total_price) - Number(o.refunded_amount ?? 0))])
  );

  const revenue = Object.values(netRevenueByOrder).reduce((sum, n) => sum + n, 0);

  // Profit: fetch order items for paid orders, then product costs separately
  let profit: number | null = null;
  let profitProductCount = 0;

  if (paidOrderIds.length > 0) {
    const { data: itemsRaw } = await supabase
      .from("order_items")
      .select("order_id, price, quantity, product_id")
      .in("order_id", paidOrderIds);

    const items = (itemsRaw ?? []) as { order_id: string; price: number; quantity: number; product_id: string }[];

    if (items.length > 0) {
      const productIds = [...new Set(items.map((i) => i.product_id))];
      const { data: costRows } = await supabase
        .from("products")
        .select("id, cost")
        .in("id", productIds)
        .not("cost", "is", null);

      const costMap = Object.fromEntries(
        ((costRows ?? []) as { id: string; cost: number }[]).map((p) => [p.id, p.cost])
      );

      // Scale each order's item revenue down by the same fraction that was
      // refunded — we don't know which specific items a partial refund
      // covered, so this approximates proportionally across the order.
      const refundFactorByOrder = Object.fromEntries(
        paidOrders.map((o) => {
          const total = Number(o.total_price);
          return [o.id, total > 0 ? (netRevenueByOrder[o.id] ?? 0) / total : 1];
        })
      );

      profitProductCount = Object.keys(costMap).length;

      if (profitProductCount > 0) {
        profit = items.reduce((sum, item) => {
          const cost = costMap[item.product_id];
          if (cost == null) return sum;
          const factor = refundFactorByOrder[item.order_id] ?? 1;
          return sum + (Number(item.price) - Number(cost)) * item.quantity * factor;
        }, 0);
      }
    }
  }

  return {
    productCount: products.count ?? 0,
    publishedCount: productRows.filter((p) => p.is_published).length,
    inventoryValue,
    categoryCount: categories.count ?? 0,
    orderCount: orders.count ?? 0,
    revenue,
    profit,
    profitProductCount,
  };
}

export default async function AdminDashboard() {
  const [stats] = await Promise.all([getStats()]);

  const profitValue = stats.profit === null
    ? "—"
    : formatPrice(stats.profit * 100);
  const profitSub = stats.profit === null
    ? "Add cost to products"
    : stats.profitProductCount > 0
      ? `${stats.profitProductCount} product${stats.profitProductCount === 1 ? "" : "s"} with cost data`
      : undefined;

  const statCards = [
    { label: "Total Products", value: stats.productCount, sub: `${stats.publishedCount} published · ${formatPrice(stats.inventoryValue * 100)} value`, icon: Package },
    { label: "Categories", value: stats.categoryCount, icon: FolderOpen },
    { label: "Total Orders", value: stats.orderCount, icon: ShoppingCart },
    { label: "Profit", value: profitValue, sub: profitSub, icon: TrendingUp, negative: typeof stats.profit === "number" && stats.profit < 0 },
    { label: "Revenue", value: formatPrice(stats.revenue * 100), icon: DollarSign },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">{card.label}</span>
                <Icon className="h-4 w-4 text-gray-400" />
              </div>
              <p className={`mt-2 text-2xl font-bold ${"negative" in card && card.negative ? "text-red-600" : "text-gray-900"}`}>
                {card.value}
              </p>
              {card.sub && <p className="mt-0.5 text-xs text-gray-400">{card.sub}</p>}
            </div>
          );
        })}
      </div>

    </div>
  );
}
