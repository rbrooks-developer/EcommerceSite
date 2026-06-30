"use server";

import { revalidatePath, refresh } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getEasyPostClient } from "@/lib/easypost/client";
import { EASYPOST_MAX_INSURABLE_VALUE } from "@/lib/easypost/protection";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getSettings } from "@/lib/data/settings";
import { sendShippingUpdate } from "@/lib/emails/shippingUpdate";
import type { Order, OrderItem, Product, StoreAddress } from "@/types";

type OrderStatus = "pending" | "paid" | "shipped" | "fulfilled" | "cancelled" | "refunded" | "partially_refunded";

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  refresh();
}

export async function cancelOrder(orderId: string) {
  const supabase = createServiceClient();

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

  // Set status immediately after the refund call returns, before any other
  // (slower) work below — the charge.refunded webhook fires as a direct
  // result of the refund call above and will overwrite this to "refunded"
  // once it lands. Inventory restoration and eBay relisting are handled
  // exclusively by that webhook so they happen exactly once, regardless of
  // whether the refund was triggered here or directly in the Stripe dashboard.
  const { error: statusError } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);
  if (statusError) throw new Error(`Failed to update order status: ${statusError.message}`);

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  refresh();
}

interface LabelResult {
  orderId: string;
  success: boolean;
  trackingNumber?: string;
  labelUrl?: string;
  error?: string;
}

export async function generateLabels(orderIds: string[]): Promise<LabelResult[]> {
  const supabase = createServiceClient();
  const settings = await getSettings();
  const storeAddress = settings?.store_address as StoreAddress | null;
  const homepage = settings?.homepage_config as import("@/types").HomepageConfig | null;
  const footer   = settings?.footer_config   as import("@/types").FooterConfig   | null;
  const displayName = homepage?.hero_display_name || footer?.display_name || null;

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
        // Signature confirmation affects carrier pricing, so it has to be
        // requested up front — it can't be bolted on at purchase time.
        options: {
          label_format: "PDF",
          ...(order.signature_required ? { delivery_confirmation: "SIGNATURE" } : {}),
        },
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
      const purchased = order.insurance_required
        ? await easypost.Shipment.buy(shipment.id, lowestRate, Math.min(order.subtotal, EASYPOST_MAX_INSURABLE_VALUE))
        : await easypost.Shipment.buy(shipment.id, lowestRate);

      const trackingNumber: string = purchased.tracking_code ?? "";
      const labelUrl: string = purchased.postage_label?.label_url ?? "";
      const shipmentId: string = purchased.id ?? "";

      // Update order
      await supabase
        .from("orders")
        .update({
          status: "shipped",
          tracking_number: trackingNumber,
          shipping_label_url: labelUrl,
          easypost_shipment_id: shipmentId,
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
          displayName,
        }).catch((err) => console.error("Shipping email failed:", err));
      }

      results.push({ orderId, success: true, trackingNumber, labelUrl });
    } catch (err: any) {
      results.push({ orderId, success: false, error: err.message });
    }
  }

  revalidatePath("/admin/orders");
  refresh();
  return results;
}

export async function voidLabel(orderId: string): Promise<{ success: boolean; error?: string }> {
  const auth = await requireAdmin();
  if (auth.error) return { success: false, error: auth.error };

  const supabase = createServiceClient();

  const { data: orderRaw } = await supabase
    .from("orders")
    .select("id, status, easypost_shipment_id")
    .eq("id", orderId)
    .maybeSingle();

  const order = orderRaw as { id: string; status: string; easypost_shipment_id: string | null } | null;
  if (!order) return { success: false, error: "Order not found" };
  if (!order.easypost_shipment_id) return { success: false, error: "No EasyPost shipment ID on record — label may have been generated before this feature was added" };

  try {
    const easypost = getEasyPostClient() as any;
    await easypost.Shipment.refund(order.easypost_shipment_id);
  } catch (err: any) {
    return { success: false, error: err.message ?? "EasyPost refund failed" };
  }

  await supabase
    .from("orders")
    .update({
      status: "paid",
      tracking_number: null,
      shipping_label_url: null,
      easypost_shipment_id: null,
    })
    .eq("id", orderId);

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  refresh();
  return { success: true };
}
