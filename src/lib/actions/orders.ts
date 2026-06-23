"use server";

import { revalidatePath } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getEasyPostClient } from "@/lib/easypost/client";
import { getSettings } from "@/lib/data/settings";
import { sendShippingUpdate } from "@/lib/emails/shippingUpdate";
import type { Order, OrderItem, Product, StoreAddress } from "@/types";

type OrderStatus = "pending" | "paid" | "shipped" | "fulfilled" | "cancelled";

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function cancelOrder(orderId: string) {
  const supabase = await createServiceClient();

  const { data: orderRaw } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRaw) throw new Error("Order not found");
  const order = orderRaw as Order;

  if (!["paid", "shipped"].includes(order.status)) {
    throw new Error("Only paid or shipped orders can be cancelled");
  }

  // Issue Stripe refund
  if (order.stripe_session_id) {
    try {
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id);
      const paymentIntentId = session.payment_intent as string | null;
      if (paymentIntentId) {
        await stripe.refunds.create({ payment_intent: paymentIntentId });
      }
    } catch (err: any) {
      throw new Error(`Stripe refund failed: ${err.message}`);
    }
  }

  // Restore inventory for each item
  const { data: itemsRaw } = await supabase
    .from("order_items")
    .select("product_id, quantity")
    .eq("order_id", orderId);

  const items = (itemsRaw ?? []) as Pick<OrderItem, "product_id" | "quantity">[];
  for (const item of items) {
    await supabase.rpc("increment_inventory", {
      product_id: item.product_id,
      amount: item.quantity,
    });
  }

  await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

interface LabelResult {
  orderId: string;
  success: boolean;
  trackingNumber?: string;
  labelUrl?: string;
  error?: string;
}

export async function generateLabels(orderIds: string[]): Promise<LabelResult[]> {
  const supabase = await createServiceClient();
  const settings = await getSettings();
  const storeAddress = settings?.store_address as StoreAddress | null;

  if (!storeAddress?.street1) {
    throw new Error("Store address not configured. Update Site Settings first.");
  }

  const results: LabelResult[] = [];

  for (const orderId of orderIds) {
    try {
      // Load order
      const { data: orderRaw } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .maybeSingle();
      if (!orderRaw) throw new Error("Order not found");
      const order = orderRaw as Order;

      if (order.status !== "paid") {
        throw new Error(`Order status is "${order.status}" — only paid orders can have labels generated`);
      }

      // Load order items with product dimensions
      const { data: itemsRaw } = await supabase
        .from("order_items")
        .select("*, products(id, name, weight_oz, length_in, width_in, height_in)")
        .eq("order_id", orderId);

      type ItemWithProduct = OrderItem & {
        products: Pick<Product, "id" | "name" | "weight_oz" | "length_in" | "width_in" | "height_in"> | null;
      };
      const items = (itemsRaw ?? []) as ItemWithProduct[];

      let totalWeightOz = 0;
      let maxLength = 1;
      let maxWidth = 1;
      let maxHeight = 1;

      for (const item of items) {
        if (!item.products) continue;
        totalWeightOz += Number(item.products.weight_oz) * item.quantity;
        maxLength = Math.max(maxLength, Number(item.products.length_in));
        maxWidth = Math.max(maxWidth, Number(item.products.width_in));
        maxHeight = Math.max(maxHeight, Number(item.products.height_in));
      }

      const easypost = getEasyPostClient() as any;

      const shipment = await easypost.Shipment.create({
        to_address: {
          name: order.shipping_name,
          street1: order.shipping_address_line1,
          street2: order.shipping_address_line2 ?? "",
          city: order.shipping_city,
          state: order.shipping_state,
          zip: order.shipping_zip,
          country: order.shipping_country,
        },
        from_address: {
          name: storeAddress.name,
          street1: storeAddress.street1,
          street2: storeAddress.street2 ?? "",
          city: storeAddress.city,
          state: storeAddress.state,
          zip: storeAddress.zip,
          country: storeAddress.country,
          phone: storeAddress.phone ?? "",
        },
        parcel: {
          weight: totalWeightOz,
          length: maxLength,
          width: maxWidth,
          height: maxHeight,
        },
      });

      const lowestRate = shipment.lowestRate();
      const purchased = await easypost.Shipment.buy(shipment.id, lowestRate);

      const trackingNumber: string = purchased.tracking_code ?? "";
      const labelUrl: string = purchased.postage_label?.label_url ?? "";

      // Update order
      await supabase
        .from("orders")
        .update({
          status: "shipped",
          tracking_number: trackingNumber,
          shipping_label_url: labelUrl,
        })
        .eq("id", orderId);

      // Send shipping update email
      const { data: profileRaw } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", order.user_id)
        .maybeSingle();

      const customerEmail = (profileRaw as { email: string } | null)?.email;
      if (customerEmail) {
        const siteTitle = settings?.site_title ?? "My Store";
        const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        await sendShippingUpdate({
          to: customerEmail,
          orderNumber: orderId.slice(0, 8).toUpperCase(),
          trackingNumber,
          carrier: lowestRate?.carrier ?? "Carrier",
          siteTitle,
          siteUrl,
        }).catch((err) => console.error("Shipping email failed:", err));
      }

      results.push({ orderId, success: true, trackingNumber, labelUrl });
    } catch (err: any) {
      results.push({ orderId, success: false, error: err.message });
    }
  }

  revalidatePath("/admin/orders");
  return results;
}
