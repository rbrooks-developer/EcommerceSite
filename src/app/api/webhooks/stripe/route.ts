import { NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";
import { revalidateTag } from "next/cache";
import { getStripeClient } from "@/lib/stripe/client";
import { createServiceClient } from "@/lib/supabase/server";
import { sendOrderConfirmation } from "@/lib/emails/orderConfirmation";
import { sendOrderCancellation } from "@/lib/emails/orderCancellation";
import { getSettings } from "@/lib/data/settings";
import { getValidEbayConfig } from "@/lib/ebay/auth";
import { decrementEbayInventory, restoreEbayInventory } from "@/lib/ebay/trading";
import { writeAdminNotification } from "@/lib/admin/notify";
import type { Order, OrderItem } from "@/types";

export const dynamic = "force-dynamic";

// ── Shared fulfillment logic for both checkout.session.completed and payment_intent.succeeded ──

async function fulfillOrder(
  supabase: ReturnType<typeof createServiceClient>,
  orderId: string,
  options: {
    sessionId?: string | null;
    paymentIntentId?: string | null;
    customerEmailFallback?: string | null;
  }
) {
  const { data: orderRaw } = await supabase
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (!orderRaw) {
    console.error("[webhook] fulfillOrder: order not found:", orderId);
    return;
  }

  const order = orderRaw as Order;

  await supabase
    .from("orders")
    .update({
      status: "paid",
      ...(options.sessionId ? { stripe_session_id: options.sessionId } : {}),
      ...(options.paymentIntentId ? { stripe_payment_intent_id: options.paymentIntentId } : {}),
    })
    .eq("id", orderId);

  const { data: rawItems } = await supabase
    .from("order_items")
    .select("*, products(name)")
    .eq("order_id", orderId);

  const orderItems = (rawItems ?? []) as (OrderItem & { products: { name: string } | null })[];

  // Decrement local inventory
  type EbaySyncItem = { listingId: string; qty: number; productName: string; productId: string };
  const ebaySyncItems: EbaySyncItem[] = [];

  for (const item of orderItems) {
    const { data: prod } = await supabase
      .from("products")
      .select("inventory, ebay_listing_id")
      .eq("id", item.product_id)
      .maybeSingle();
    const prodData = prod as { inventory: number; ebay_listing_id: string | null } | null;
    const current = prodData?.inventory ?? 0;
    const next = Math.max(0, current - item.quantity);
    const { error: invErr } = await supabase
      .from("products")
      .update({ inventory: next })
      .eq("id", item.product_id);
    if (invErr) {
      console.error(`inventory update failed for ${item.product_id}:`, invErr.message);
    } else {
      console.log(`[webhook] inventory ${item.product_id}: ${current} → ${next}`);
    }
    if (prodData?.ebay_listing_id) {
      ebaySyncItems.push({
        listingId: prodData.ebay_listing_id,
        qty: item.quantity,
        productName: item.products?.name ?? "Unknown Product",
        productId: item.product_id,
      });
    }
  }

  revalidateTag("products", "default");

  // eBay sync in background
  if (ebaySyncItems.length > 0) {
    waitUntil((async () => {
      const ebayConfig = await getValidEbayConfig();
      if (!ebayConfig?.access_token) {
        console.error("[webhook] eBay inventory sync skipped: no valid eBay config");
        await writeAdminNotification({
          type: "ebay_inventory_sync_error",
          severity: "warning",
          title: "eBay Inventory Sync Skipped — No eBay Connection",
          body: `Order ${orderId.slice(0, 8).toUpperCase()} was paid but eBay inventory could not be updated because no valid eBay access token is configured. Please update the listings manually.`,
          metadata: {
            order_id: orderId,
            order_number: orderId.slice(0, 8).toUpperCase(),
            action: "decrement",
            error: "No valid eBay access token",
          },
        });
        return;
      }
      for (const { listingId, qty, productName, productId } of ebaySyncItems) {
        try {
          const action = await decrementEbayInventory(listingId, qty, ebayConfig);
          console.log(`[webhook] eBay ${listingId}: ${action} (sold ${qty})`);
        } catch (err: any) {
          console.error(`[webhook] eBay sync failed for ${listingId}:`, err.message);
          await writeAdminNotification({
            type: "ebay_inventory_sync_error",
            severity: "error",
            title: "eBay Inventory Sync Failed",
            body: `After order ${orderId.slice(0, 8).toUpperCase()} was paid, the eBay listing could not be updated automatically. Please adjust the listing quantity (or end it) manually.`,
            metadata: {
              order_id: orderId,
              order_number: orderId.slice(0, 8).toUpperCase(),
              product_id: productId,
              product_name: productName,
              ebay_listing_id: listingId,
              quantity: qty,
              action: "decrement",
              error: err.message,
            },
          });
        }
      }
    })());
  }

  if (order.user_id) {
    await Promise.all([
      supabase.from("cart_items").delete().eq("user_id", order.user_id),
      supabase.from("cart_promos").delete().eq("user_id", order.user_id),
    ]);
    console.log(`[webhook] cart cleared for user ${order.user_id}`);
  }

  // Record promo redemption
  const orderWithPromo = order as typeof order & { promo_id?: string | null; discount_amount?: number; shipping_discount?: number };
  if (orderWithPromo.promo_id) {
    const customerEmailForPromo = (await supabase.from("profiles").select("email").eq("id", order.user_id).maybeSingle()).data as { email: string } | null;
    await supabase.from("promo_redemptions").insert({
      promo_id: orderWithPromo.promo_id,
      order_id: orderId,
      customer_id: order.user_id,
      customer_email: customerEmailForPromo?.email ?? null,
      discount_amount: Number(orderWithPromo.discount_amount ?? 0),
      shipping_discount: Number(orderWithPromo.shipping_discount ?? 0),
    });
    const { data: promoRow } = await supabase.from("promos").select("current_uses").eq("id", orderWithPromo.promo_id).maybeSingle();
    if (promoRow) {
      await supabase.from("promos").update({ current_uses: (promoRow as { current_uses: number }).current_uses + 1 }).eq("id", orderWithPromo.promo_id);
    }
    console.log(`[webhook] promo ${orderWithPromo.promo_id} redeemed for order ${orderId}`);
  }

  // Send confirmation email
  const { data: profileRaw, error: profileErr } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", order.user_id)
    .maybeSingle();

  if (profileErr) console.error("[webhook] profile lookup error:", profileErr.message);

  const customerEmail =
    (profileRaw as { email: string } | null)?.email ?? options.customerEmailFallback ?? null;

  console.log("[webhook] resolved customerEmail:", customerEmail ?? "(null — skipping email)");

  if (customerEmail) {
    const settings = await getSettings();
    const homepage = settings?.homepage_config as import("@/types").HomepageConfig | null;
    const footer = settings?.footer_config as import("@/types").FooterConfig | null;
    const displayName = homepage?.hero_display_name || footer?.display_name || null;

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
      displayName,
      promoCode: (order as any).promo_code ?? null,
      discountAmount: Number((order as any).discount_amount ?? 0),
      shippingDiscount: Number((order as any).shipping_discount ?? 0),
      surchargeAmount: Number((order as any).surcharge_amount ?? 0) || undefined,
      surchargePercentage: Number((order as any).surcharge_percentage ?? 0) || undefined,
    })
      .then(() => console.log("[webhook] confirmation email sent successfully"))
      .catch((err) => console.error("[webhook] failed to send confirmation email:", err.message, err));
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

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

    // ── Stripe Checkout Session (legacy hosted checkout) ───────────────────
    case "checkout.session.completed": {
      const session = event.data.object as {
        id: string;
        payment_intent?: string | null;
        metadata?: { order_id?: string; offer_ids?: string };
        customer_email?: string | null;
      };
      const orderId = session.metadata?.order_id;
      if (!orderId) {
        console.error("checkout.session.completed: no order_id in metadata");
        break;
      }

      await fulfillOrder(supabase, orderId, {
        sessionId: session.id,
        paymentIntentId: session.payment_intent ?? null,
        customerEmailFallback: session.customer_email ?? null,
      });

      // Mark offers purchased
      const offerIdsRaw = session.metadata?.offer_ids ?? "";
      const offerIds = offerIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (offerIds.length > 0) {
        const { error: offerErr } = await supabase
          .from("product_offers")
          .update({ status: "purchased", updated_at: new Date().toISOString() })
          .in("id", offerIds);
        if (offerErr) console.error("[webhook] failed to mark offers purchased:", offerErr.message);
        else console.log(`[webhook] marked ${offerIds.length} offer(s) as purchased`);
      }

      break;
    }

    // ── Payment Element (new embedded checkout) ────────────────────────────
    case "payment_intent.succeeded": {
      const intent = event.data.object as {
        id: string;
        metadata?: { order_id?: string; offer_ids?: string };
        receipt_email?: string | null;
      };
      const orderId = intent.metadata?.order_id;
      if (!orderId) {
        console.error("payment_intent.succeeded: no order_id in metadata");
        break;
      }

      await fulfillOrder(supabase, orderId, {
        paymentIntentId: intent.id,
        customerEmailFallback: intent.receipt_email ?? null,
      });

      // Mark offers purchased
      const offerIdsRaw = intent.metadata?.offer_ids ?? "";
      const offerIds = offerIdsRaw.split(",").map((s) => s.trim()).filter(Boolean);
      if (offerIds.length > 0) {
        const { error: offerErr } = await supabase
          .from("product_offers")
          .update({ status: "purchased", updated_at: new Date().toISOString() })
          .in("id", offerIds);
        if (offerErr) console.error("[webhook] failed to mark offers purchased:", offerErr.message);
        else console.log(`[webhook] marked ${offerIds.length} offer(s) as purchased`);
      }

      break;
    }

    // ── Payment failed — cancel pending order ──────────────────────────────
    case "payment_intent.payment_failed": {
      const intent = event.data.object as { id: string; metadata?: { order_id?: string } };
      const orderId = intent.metadata?.order_id;
      if (orderId) {
        await supabase
          .from("orders")
          .update({ status: "cancelled" })
          .eq("id", orderId)
          .eq("status", "pending");
        console.log("[webhook] payment_intent.payment_failed: cancelled order", orderId);
      }
      break;
    }

    // ── Checkout abandoned / timed out ─────────────────────────────────────
    case "checkout.session.expired": {
      const session = event.data.object as { metadata?: { order_id?: string } };
      const orderId = session.metadata?.order_id;
      if (!orderId) break;
      await supabase
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("status", "pending");
      console.log("checkout.session.expired: cancelled order", orderId);
      break;
    }

    // ── Refund issued ──────────────────────────────────────────────────────
    case "charge.refunded": {
      const charge = event.data.object as {
        payment_intent?: string | null;
        amount_refunded: number;
        amount: number;
        refunds?: { data: Array<{ metadata?: Record<string, string> }> };
      };

      console.log(`[webhook] charge.refunded: payment_intent=${charge.payment_intent ?? "null"} amount=${charge.amount} amount_refunded=${charge.amount_refunded}`);

      if (!charge.payment_intent) {
        console.error("[webhook] charge.refunded: no payment_intent on charge — cannot look up order");
        break;
      }

      const { data: orderRow } = await supabase
        .from("orders")
        .select("*")
        .eq("stripe_payment_intent_id", charge.payment_intent)
        .maybeSingle();
      const refundedOrder = orderRow as Order | null;
      const orderId = refundedOrder?.id;

      console.log(`[webhook] charge.refunded: order lookup — id=${orderId ?? "NOT FOUND"} status=${refundedOrder?.status ?? "n/a"}`);

      if (!orderId) {
        console.error("charge.refunded: no order found for payment_intent", charge.payment_intent);
        await writeAdminNotification({
          type: "refund_order_not_found",
          severity: "warning",
          title: "Refund Received — Order Not Found",
          body: `Stripe sent a charge.refunded event but no order with payment_intent ${charge.payment_intent} was found. eBay inventory was not restored.`,
          metadata: { error: `payment_intent: ${charge.payment_intent}` },
        });
        break;
      }

      const isFullRefund = charge.amount_refunded >= charge.amount;
      const { error: statusUpdateError } = await supabase
        .from("orders")
        .update({
          status: isFullRefund ? "refunded" : "partially_refunded",
          refunded_amount: charge.amount_refunded / 100,
        })
        .eq("id", orderId);

      if (statusUpdateError) {
        console.error(`charge.refunded: failed to update order ${orderId} status:`, statusUpdateError.message);
        await writeAdminNotification({
          type: "refund_status_update_failed",
          severity: "error",
          title: "Refund Received — Order Status Not Updated",
          body: `Order ${orderId.slice(0, 8).toUpperCase()} was refunded by Stripe but its status could not be updated: ${statusUpdateError.message}`,
          metadata: { order_id: orderId, error: statusUpdateError.message },
        });
      } else {
        console.log(`charge.refunded: order ${orderId} → ${isFullRefund ? "refunded" : "partially_refunded"}`);
      }

      const latestRefund = charge.refunds?.data?.[0];
      const isAdminCancel = latestRefund?.metadata?.source === "admin_cancel";
      const isOrderCancellation = isAdminCancel && latestRefund?.metadata?.is_order_cancellation === "yes";
      let shouldRestoreInventory: boolean;
      if (isAdminCancel) {
        shouldRestoreInventory = latestRefund?.metadata?.restore_inventory !== "no";
      } else {
        shouldRestoreInventory = true;
      }

      console.log(`[webhook] charge.refunded: isAdminCancel=${isAdminCancel} isOrderCancellation=${isOrderCancellation} shouldRestoreInventory=${shouldRestoreInventory}`);

      if (shouldRestoreInventory) {
        const { data: itemsRaw } = await supabase
          .from("order_items")
          .select("product_id, quantity")
          .eq("order_id", orderId);

        console.log(`[webhook] charge.refunded: restoring inventory for ${(itemsRaw ?? []).length} item(s)`);
        for (const item of (itemsRaw ?? []) as { product_id: string; quantity: number }[]) {
          const { error: invErr } = await supabase.rpc("increment_inventory", {
            product_id: item.product_id,
            amount: item.quantity,
          });
          if (invErr) {
            console.error(`charge.refunded: inventory restore FAILED for product_id=${item.product_id}:`, invErr.message);
          } else {
            console.log(`[webhook] charge.refunded: inventory restored product_id=${item.product_id} +${item.quantity}`);
          }
        }
        revalidateTag("products", "default");
        console.log(`[webhook] inventory restored for order ${orderId}`);
      }

      // Cancellation/refund email
      if (refundedOrder) {
        const { data: profileRaw } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", refundedOrder.user_id)
          .maybeSingle();
        const customerEmail = (profileRaw as { email: string } | null)?.email ?? null;

        if (customerEmail) {
          const { data: rawItems } = await supabase
            .from("order_items")
            .select("*, products(name)")
            .eq("order_id", orderId);
          const refundItemsForEmail = (rawItems ?? []) as (OrderItem & { products: { name: string } | null })[];

          const settings = await getSettings();
          const homepage = settings?.homepage_config as import("@/types").HomepageConfig | null;
          const footer = settings?.footer_config as import("@/types").FooterConfig | null;
          const displayName = homepage?.hero_display_name || footer?.display_name || null;

          await sendOrderCancellation({
            to: customerEmail,
            orderNumber: orderId.slice(0, 8).toUpperCase(),
            items: refundItemsForEmail.map((i) => ({
              name: i.products?.name ?? "Product",
              quantity: i.quantity,
              price: Number(i.price),
            })),
            totalPrice: Number(refundedOrder.total_price),
            refundAmount: charge.amount_refunded / 100,
            isFullRefund,
            siteTitle: settings?.site_title ?? "My Store",
            displayName,
          })
            .then(() => console.log("[webhook] cancellation/refund email sent successfully"))
            .catch((err) => console.error("[webhook] failed to send cancellation/refund email:", err.message, err));
        }
      }

      // eBay inventory restore
      if ((isFullRefund || isOrderCancellation) && shouldRestoreInventory) {
        waitUntil((async () => {
          const { data: refundItems } = await supabase
            .from("order_items")
            .select("product_id, quantity, products(name, ebay_listing_id)")
            .eq("order_id", orderId);

          if (!refundItems || refundItems.length === 0) return;

          const ebayConfig = await getValidEbayConfig();
          if (!ebayConfig?.access_token) {
            console.error("[webhook] eBay relist skipped: no valid eBay config");
            await writeAdminNotification({
              type: "ebay_relist_error",
              severity: "warning",
              title: "eBay Relist Skipped — No eBay Connection",
              body: `Order ${orderId.slice(0, 8).toUpperCase()} was refunded but eBay inventory could not be restored because no valid eBay access token is configured. Please relist the items manually.`,
              metadata: {
                order_id: orderId,
                order_number: orderId.slice(0, 8).toUpperCase(),
                action: "relist",
                error: "No valid eBay access token",
              },
            });
            return;
          }

          for (const item of refundItems) {
            const p = item.products as unknown as { name: string; ebay_listing_id: string | null } | null;
            const listingId = p?.ebay_listing_id;
            if (!listingId) continue;
            try {
              const { action, activeListingId } = await restoreEbayInventory(listingId, item.quantity, ebayConfig);
              console.log(`[webhook] eBay refund restore: ${action} ${listingId} → ${activeListingId} (qty +${item.quantity})`);
              if (action === "relisted" && activeListingId !== listingId) {
                await supabase.from("products").update({ ebay_listing_id: activeListingId }).eq("id", item.product_id);
              }
              await writeAdminNotification({
                type: "ebay_relist_success",
                severity: "info",
                title: action === "relisted" ? "eBay Listing Relisted After Refund" : "eBay Inventory Restored After Refund",
                body: action === "relisted"
                  ? `After order ${orderId.slice(0, 8).toUpperCase()} was refunded, the eBay listing was relisted with a new ID. The product record has been updated automatically.`
                  : `After order ${orderId.slice(0, 8).toUpperCase()} was refunded, ${item.quantity} unit(s) were added back to the active eBay listing.`,
                metadata: {
                  order_id: orderId,
                  order_number: orderId.slice(0, 8).toUpperCase(),
                  product_id: item.product_id,
                  product_name: p?.name ?? "Unknown Product",
                  ebay_listing_id: activeListingId,
                  quantity: item.quantity,
                  action,
                },
              });
            } catch (err: any) {
              console.error(`[webhook] eBay relist failed for ${listingId}:`, err.message);
              await writeAdminNotification({
                type: "ebay_relist_error",
                severity: "error",
                title: "eBay Relist Failed After Refund",
                body: `After order ${orderId.slice(0, 8).toUpperCase()} was refunded, the eBay listing could not be relisted automatically. Please relist the item manually on eBay.`,
                metadata: {
                  order_id: orderId,
                  order_number: orderId.slice(0, 8).toUpperCase(),
                  product_id: item.product_id,
                  product_name: p?.name ?? "Unknown Product",
                  ebay_listing_id: listingId,
                  quantity: item.quantity,
                  action: "relist",
                  error: err.message,
                },
              });
            }
          }
        })());
      }

      break;
    }

    default:
      break;
  }

  return Response.json({ received: true });
}
