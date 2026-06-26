import { NextRequest } from "next/server";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOrderConfirmation } from "@/lib/emails/orderConfirmation";
import { getSettings } from "@/lib/data/settings";
import type { Order, OrderItem } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  console.log("[webhook] POST received at", new Date().toISOString());
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  console.log("[webhook] stripe-signature present:", !!sig);

  if (!sig) {
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripeClient();
  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    console.error("[webhook] signature verification failed:", err.message);
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  console.log("[webhook] event type:", event.type);
  const supabase = createServiceClient();

  switch (event.type) {
    // ── Payment completed ──────────────────────────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as {
        id: string;
        metadata?: { order_id?: string };
        customer_email?: string | null;
      };
      const orderId = session.metadata?.order_id;

      if (!orderId) {
        console.error("checkout.session.completed: no order_id in metadata");
        break;
      }

      const { data: orderRaw } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();

      if (!orderRaw) {
        console.error("checkout.session.completed: order not found:", orderId);
        break;
      }

      const order = orderRaw as Order;

      await supabase
        .from("orders")
        .update({ status: "paid", stripe_session_id: session.id })
        .eq("id", orderId);

      const { data: rawItems } = await supabase
        .from("order_items")
        .select("*, products(name)")
        .eq("order_id", orderId);

      const orderItems = (rawItems ?? []) as (OrderItem & { products: { name: string } | null })[];

      // Decrement inventory for each item
      for (const item of orderItems) {
        const { error: rpcError } = await supabase.rpc("decrement_inventory", {
          product_id: item.product_id,
          amount: item.quantity,
        });
        if (rpcError) {
          console.error(`decrement_inventory failed for ${item.product_id}:`, rpcError.message);
          const { data: prod } = await supabase
            .from("products")
            .select("inventory")
            .eq("id", item.product_id)
            .maybeSingle();
          const current = (prod as { inventory: number } | null)?.inventory ?? 0;
          await supabase
            .from("products")
            .update({ inventory: Math.max(0, current - item.quantity) })
            .eq("id", item.product_id);
        }
      }

      // Send confirmation email
      console.log(`[webhook] order ${orderId} paid — looking up email for user ${order.user_id}`);

      const { data: profileRaw, error: profileErr } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", order.user_id)
        .maybeSingle();

      if (profileErr) console.error("[webhook] profile lookup error:", profileErr.message);
      console.log("[webhook] profile email:", (profileRaw as any)?.email ?? "(none)");
      console.log("[webhook] session customer_email:", session.customer_email ?? "(none)");

      const customerEmail =
        (profileRaw as { email: string } | null)?.email ?? session.customer_email ?? null;

      console.log("[webhook] resolved customerEmail:", customerEmail ?? "(null — skipping email)");

      if (customerEmail) {
        const settings = await getSettings();
        const shippingAddressParts = [
          order.shipping_address_line1,
          order.shipping_address_line2,
          `${order.shipping_city}, ${order.shipping_state} ${order.shipping_zip}`,
          order.shipping_country,
        ].filter(Boolean);

        console.log(`[webhook] sending confirmation email to ${customerEmail}`);
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
          siteTitle: settings?.site_title ?? "My Store",
        }).then(() => console.log("[webhook] confirmation email sent successfully"))
          .catch((err) => console.error("[webhook] failed to send confirmation email:", err.message, err));
      }

      break;
    }

    // ── Checkout abandoned / timed out ────────────────────────────────────
    case "checkout.session.expired": {
      const session = event.data.object as { metadata?: { order_id?: string } };
      const orderId = session.metadata?.order_id;

      if (!orderId) break;

      // Only cancel if still pending — don't touch paid orders
      await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("status", "pending");

      console.log("checkout.session.expired: cancelled order", orderId);
      break;
    }

    // ── Refund issued ─────────────────────────────────────────────────────
    case "charge.refunded": {
      const charge = event.data.object as {
        payment_intent?: string | null;
        amount_refunded: number;
        amount: number;
      };

      if (!charge.payment_intent) break;

      // Look up the checkout session for this payment intent to get our order_id
      const sessions = await stripe.checkout.sessions.list({
        payment_intent: charge.payment_intent,
        limit: 1,
      });
      const orderId = sessions.data[0]?.metadata?.order_id;

      if (!orderId) {
        console.error("charge.refunded: no order found for payment_intent", charge.payment_intent);
        break;
      }

      const isFullRefund = charge.amount_refunded >= charge.amount;
      await supabase
        .from("orders")
        .update({ status: isFullRefund ? "refunded" : "partially_refunded" })
        .eq("id", orderId);

      console.log(`charge.refunded: order ${orderId} → ${isFullRefund ? "refunded" : "partially_refunded"}`);
      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}
