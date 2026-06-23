import { NextRequest } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOrderConfirmation } from "@/lib/emails/orderConfirmation";
import { getSettings } from "@/lib/data/settings";
import type { Order, OrderItem, Product } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripeClient();
  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err.message);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return Response.json({ received: true });
  }

  const session = event.data.object as { id: string; metadata?: { order_id?: string }; customer_email?: string | null };
  const orderId = session.metadata?.order_id;

  if (!orderId) {
    console.error("No order_id in Stripe session metadata");
    return Response.json({ error: "Missing order_id" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Load the order
  const { data: orderRaw } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRaw) {
    console.error("Order not found:", orderId);
    return Response.json({ error: "Order not found" }, { status: 404 });
  }

  const order = orderRaw as Order;

  // Update order to paid and save stripe_session_id (belt + suspenders)
  await supabase
    .from("orders")
    .update({ status: "paid", stripe_session_id: session.id })
    .eq("id", orderId);

  // Load order items with product info
  const { data: rawItems } = await supabase
    .from("order_items")
    .select("*, products(name)")
    .eq("order_id", orderId);

  const orderItems = (rawItems ?? []) as (OrderItem & { products: { name: string } | null })[];

  // Decrement inventory
  for (const item of orderItems) {
    await supabase.rpc("decrement_inventory", {
      product_id: item.product_id,
      amount: item.quantity,
    }).then(({ error }) => {
      if (error) {
        // Fallback: manual update
        return supabase
          .from("products")
          .update({ inventory: 0 })
          .eq("id", item.product_id);
      }
    });
  }

  // Get customer email
  const { data: profileRaw } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", order.user_id)
    .maybeSingle();

  const customerEmail = (profileRaw as { email: string } | null)?.email ?? session.customer_email ?? null;

  if (customerEmail) {
    const settings = await getSettings();
    const siteTitle = settings?.site_title ?? "My Store";
    const shippingAddressParts = [
      order.shipping_address_line1,
      order.shipping_address_line2,
      `${order.shipping_city}, ${order.shipping_state} ${order.shipping_zip}`,
      order.shipping_country,
    ].filter(Boolean);

    await sendOrderConfirmation({
      to: customerEmail,
      orderNumber: orderId.slice(0, 8).toUpperCase(),
      items: orderItems.map((i) => ({
        name: i.products?.name ?? "Product",
        quantity: i.quantity,
        price: Number(i.price),
      })),
      subtotal: Number(order.subtotal),
      shippingCost: Number(order.shipping_cost),
      taxAmount: Number(order.tax_amount),
      totalPrice: Number(order.total_price),
      shippingName: order.shipping_name ?? "",
      shippingAddress: shippingAddressParts.join(", "),
      siteTitle,
    }).catch((err) => console.error("Failed to send order confirmation email:", err));
  }

  return Response.json({ received: true });
}
