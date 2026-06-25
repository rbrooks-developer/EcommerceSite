import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/utils";
import { CheckCircle } from "lucide-react";
import { ClearCart } from "./ClearCart";
import type { Order, OrderItem, Product } from "@/types";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  let order: Order | null = null;
  let orderItems: (OrderItem & { products: { name: string; images: unknown } | null })[] = [];

  if (session_id) {
    const supabase = await createClient();
    const { data: orderRaw } = await supabase
      .from("orders")
      .select("*")
      .eq("stripe_session_id", session_id)
      .maybeSingle();

    if (orderRaw) {
      order = orderRaw as Order;
      const { data: itemsRaw } = await supabase
        .from("order_items")
        .select("*, products(name, images)")
        .eq("order_id", order.id);
      orderItems = (itemsRaw ?? []) as (OrderItem & { products: { name: string; images: unknown } | null })[];
    }
  }

  const panelStyle: React.CSSProperties = {
    border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)",
    backgroundColor: "color-mix(in srgb, var(--site-fg) 5%, var(--site-bg))",
  };

  const dividerStyle: React.CSSProperties = {
    borderTop: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)",
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <ClearCart />
      <div className="text-center mb-8">
        <CheckCircle className="mx-auto h-14 w-14 text-green-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
        <p style={{ opacity: 0.55 }}>
          {order
            ? `Order #${order.id.slice(0, 8).toUpperCase()} has been placed.`
            : "Your order has been placed."}
        </p>
        <p className="text-sm mt-1" style={{ opacity: 0.4 }}>
          You'll receive a confirmation email shortly.
        </p>
      </div>

      {order && (
        <div className="rounded-lg p-6 space-y-5" style={panelStyle}>
          {orderItems.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3">Items Ordered</h2>
              <ul className="space-y-2">
                {orderItems.map((item) => (
                  <li key={item.id} className="flex justify-between text-sm">
                    <span style={{ opacity: 0.75 }}>
                      {item.products?.name ?? "Product"} × {item.quantity}
                    </span>
                    <span className="font-medium">
                      {formatPrice(Number(item.price) * item.quantity * 100)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-4 space-y-1.5 text-sm" style={dividerStyle}>
            <div className="flex justify-between" style={{ opacity: 0.7 }}>
              <span>Subtotal</span>
              <span>{formatPrice(Number(order.subtotal) * 100)}</span>
            </div>
            <div className="flex justify-between" style={{ opacity: 0.7 }}>
              <span>Shipping</span>
              <span>{formatPrice(Number(order.shipping_cost) * 100)}</span>
            </div>
            {Number(order.tax_amount) > 0 && (
              <div className="flex justify-between" style={{ opacity: 0.7 }}>
                <span>Tax</span>
                <span>{formatPrice(Number(order.tax_amount) * 100)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold pt-1.5" style={dividerStyle}>
              <span>Total</span>
              <span>{formatPrice(Number(order.total_price) * 100)}</span>
            </div>
          </div>

          {order.shipping_address_line1 && (
            <div className="pt-4" style={dividerStyle}>
              <p className="text-xs font-medium uppercase tracking-wide mb-1" style={{ opacity: 0.45 }}>Shipping to</p>
              <p className="text-sm" style={{ opacity: 0.75 }}>
                {order.shipping_name}<br />
                {order.shipping_address_line1}
                {order.shipping_address_line2 ? `, ${order.shipping_address_line2}` : ""}<br />
                {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/products"
          className="rounded-md px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80 text-center"
          style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)" }}
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}
