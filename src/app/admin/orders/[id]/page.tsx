import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { formatPrice, formatDate } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui/badge";
import { OrderDetailActions } from "./OrderDetailActions";
import { ChevronLeft } from "lucide-react";
import type { Order, OrderItem, Product, CheckoutConfig } from "@/types";

type ItemWithProduct = OrderItem & {
  products: Pick<Product, "id" | "name" | "images"> | null;
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: orderRaw } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!orderRaw) notFound();
  const order = orderRaw as Order;

  const { data: itemsRaw } = await supabase
    .from("order_items")
    .select("*, products(id, name, images)")
    .eq("order_id", id);

  const items = (itemsRaw ?? []) as ItemWithProduct[];

  const [profileResult, settings] = await Promise.all([
    supabase.from("profiles").select("email").eq("id", order.user_id).maybeSingle(),
    getSettings(),
  ]);

  const customerEmail = (profileResult.data as { email: string } | null)?.email;
  const checkoutCfg = (settings as any)?.checkout_config as CheckoutConfig | null;
  const restockingFeePercent = checkoutCfg?.restocking_fee_active ? (checkoutCfg.restocking_fee_percent ?? 0) : 0;
  const processingFeeFlat = checkoutCfg?.restocking_fee_active ? (checkoutCfg.processing_fee_flat ?? 0) : 0;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/orders" className="text-gray-400 hover:text-gray-600">
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

      {/* Actions */}
      <OrderDetailActions order={order} restockingFeePercent={restockingFeePercent} processingFeeFlat={processingFeeFlat} />

      {/* Customer + Shipping */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Customer</h2>
          <p className="text-sm text-gray-900">{order.shipping_name}</p>
          {customerEmail && <p className="text-sm text-gray-500 mt-0.5">{customerEmail}</p>}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Shipping Address</h2>
          <p className="text-sm text-gray-700 leading-relaxed">
            {order.shipping_address_line1}
            {order.shipping_address_line2 && <><br />{order.shipping_address_line2}</>}
            <br />
            {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
            <br />
            {order.shipping_country}
          </p>
        </div>
      </div>

      {/* Tracking */}
      {(order.tracking_number || order.shipping_label_url) && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Shipping</h2>
          <div className="flex flex-wrap gap-4 items-center">
            {order.tracking_number && (
              <div>
                <p className="text-xs text-gray-400">Tracking Number</p>
                <p className="font-mono text-sm font-medium text-gray-900">{order.tracking_number}</p>
              </div>
            )}
            {order.shipping_label_url && (
              <a
                href={order.shipping_label_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Download Label PDF
              </a>
            )}
            {order.customs_form_url && (
              <a
                href={order.customs_form_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 hover:bg-amber-100 transition-colors"
              >
                Download Customs Form
              </a>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Items</h2>
        </div>
        <ul className="divide-y divide-gray-100">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-4 px-5 py-4">
              {((item.products?.images as string[]) ?? [])[0] ? (
                <div className="relative h-12 w-12 rounded-md overflow-hidden shrink-0">
                  <Image src={((item.products!.images as string[]))[0]} alt="" fill className="object-cover" sizes="48px" />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-md bg-gray-100 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {item.products?.name ?? "Deleted product"}
                </p>
                <p className="text-xs text-gray-400">Qty: {item.quantity}</p>
              </div>
              <p className="text-sm font-medium text-gray-900 shrink-0">
                {formatPrice(Number(item.price) * item.quantity * 100)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/* Totals */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Order Summary</h2>
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
              <div className="flex justify-between text-red-600">
                <span>Refunded</span>
                <span>-{formatPrice(Number(order.refunded_amount) * 100)}</span>
              </div>
              <div className="flex justify-between font-semibold text-gray-900 text-base pt-2 border-t border-gray-100">
                <span>Net</span>
                <span>{formatPrice(Math.max(0, Number(order.total_price) - Number(order.refunded_amount)) * 100)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
