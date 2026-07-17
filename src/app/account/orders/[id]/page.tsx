import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrice, formatDate } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import type { Metadata } from "next";
import type { Order, OrderItem, Product } from "@/types";

type ItemWithProduct = OrderItem & {
  products: Pick<Product, "id" | "name" | "images"> | null;
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order #${id.slice(0, 8).toUpperCase()}` };
}

export default async function AccountOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orderRaw } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id) // ensures customers can only see their own orders
    .maybeSingle();

  if (!orderRaw) notFound();
  const order = orderRaw as Order;

  const { data: itemsRaw } = await supabase
    .from("order_items")
    .select("*, products(id, name, images)")
    .eq("order_id", id);

  const items = (itemsRaw ?? []) as ItemWithProduct[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/account" className="text-gray-400 hover:text-gray-600">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Order #{id.slice(0, 8).toUpperCase()}
          </h1>
          <p className="text-sm text-gray-400">{formatDate(order.created_at)}</p>
        </div>
        <div className="ml-auto">
          <OrderStatusBadge status={order.status} />
        </div>
      </div>

      {/* Tracking */}
      {order.tracking_number && order.status !== "cancelled" && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Tracking</p>
          <p className="font-mono text-sm font-medium text-blue-900">{order.tracking_number}</p>
          <p className="text-xs text-blue-500 mt-0.5">
            Use this number on your carrier&apos;s website to track your package.
          </p>
        </div>
      )}

      {/* Shipping address */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Shipping To</h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {order.shipping_name}<br />
          {order.shipping_address_line1}
          {order.shipping_address_line2 && <><br />{order.shipping_address_line2}</>}
          <br />
          {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
        </p>
      </div>

      {/* Items */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Items</h2>
        </div>
        <ul className="divide-y divide-gray-100">
          {items.map((item) => {
            const image = ((item.products?.images as string[]) ?? [])[0];
            return (
              <li key={item.id} className="flex items-center gap-4 px-5 py-4">
                {image ? (
                  <div
                    className="h-14 w-14 rounded-md bg-cover bg-center shrink-0 bg-gray-100"
                    style={{ backgroundImage: `url(${image})` }}
                  />
                ) : (
                  <div className="h-14 w-14 rounded-md bg-gray-100 shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.products?.name ?? "Product"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">Qty: {item.quantity}</p>
                </div>
                <p className="text-sm font-medium text-gray-900 shrink-0">
                  {formatPrice(Number(item.price) * item.quantity * 100)}
                </p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Subtotal</span>
            <span>{formatPrice(Number(order.subtotal) * 100)}</span>
          </div>
          {Number(order.discount_amount) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Promo {order.promo_code ? `(${order.promo_code})` : "discount"}</span>
              <span>-{formatPrice(Number(order.discount_amount) * 100)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-600">
            <span>
              Shipping
              {Number(order.shipping_discount) > 0 && order.promo_code && (
                <span className="ml-1 text-xs text-green-600">({order.promo_code})</span>
              )}
            </span>
            {Number(order.shipping_discount) > 0
              ? <span>
                  <span className="opacity-50">{formatPrice(Number(order.shipping_cost) * 100)}</span>
                  {" "}<span className="text-green-600">- {formatPrice(Number(order.shipping_discount) * 100)}</span>
                  {" = "}
                  {Number(order.shipping_discount) >= Number(order.shipping_cost)
                    ? <span className="text-green-600 font-medium">FREE</span>
                    : <span className="font-medium">{formatPrice((Number(order.shipping_cost) - Number(order.shipping_discount)) * 100)}</span>
                  }
                </span>
              : <span>{formatPrice(Number(order.shipping_cost) * 100)}</span>
            }
          </div>
          {Number(order.tax_amount) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Tax</span>
              <span>{formatPrice(Number(order.tax_amount) * 100)}</span>
            </div>
          )}
          {Number((order as any).surcharge_amount) > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Surcharge ({Number((order as any).surcharge_percentage)}%)</span>
              <span>{formatPrice(Number((order as any).surcharge_amount) * 100)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold text-gray-900 text-base pt-2 border-t border-gray-100">
            <span>Total</span>
            <span>{formatPrice(Number(order.total_price) * 100)}</span>
          </div>
          {Number(order.refunded_amount) > 0 && (
            <>
              <div className="flex justify-between text-red-500">
                <span>{Number(order.refunded_amount) >= Number(order.total_price) ? "Refunded" : "Partially refunded"}</span>
                <span>-{formatPrice(Number(order.refunded_amount) * 100)}</span>
              </div>
              {Number(order.refunded_amount) < Number(order.total_price) && (
                <div className="flex justify-between font-semibold text-gray-900 text-base pt-2 border-t border-gray-100">
                  <span>Net paid</span>
                  <span>{formatPrice((Number(order.total_price) - Number(order.refunded_amount)) * 100)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Link
        href="/products"
        className="inline-block text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        ← Continue Shopping
      </Link>
    </div>
  );
}
