import { NextRequest } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { resolveShippingProtection } from "@/lib/easypost/protection";
import { validatePromoCode } from "@/lib/promos/validate";
import { calculatePromoDiscount } from "@/lib/promos/calculate";
import type { Product } from "@/types";

const requestSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive().max(100),
      offerId: z.string().uuid().nullable().optional(),
    })
  ).min(1).max(50),
  shippingAddress: z.object({
    name: z.string().min(1).max(100),
    address_line1: z.string().min(1).max(200),
    address_line2: z.string().max(200).optional(),
    city: z.string().min(1).max(100),
    state: z.string().max(50),
    zip: z.string().min(1).max(20),
    country: z.string().length(2),
  }),
  shippingRate: z.object({
    id: z.string().max(100),
    carrier: z.string().max(100),
    service: z.string().max(100),
    rate: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid rate format"),
    delivery_days: z.number().nullable(),
    delivery_date: z.string().nullable(),
  }),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { items, shippingAddress, shippingRate } = parsed.data;

  const productIds = items.map((i) => i.productId);
  const offerIds = items.map((i) => i.offerId).filter(Boolean) as string[];
  const sb = createServiceClient();
  const stripe = getStripeClient();

  // Fetch everything in parallel
  const [
    { data: rawProducts },
    { data: rawOffers },
    { data: cartPromo },
    settings,
    { data: pendingOrders },
  ] = await Promise.all([
    supabase.from("products").select("id, name, price, images, inventory, is_published").in("id", productIds),
    offerIds.length > 0
      ? supabase.from("product_offers").select("id, user_id, product_id, quantity, offer_price, status")
          .in("id", offerIds).eq("user_id", user.id).eq("status", "approved")
      : Promise.resolve({ data: [] }),
    sb.from("cart_promos").select("promo_code").eq("user_id", user.id).maybeSingle(),
    getSettings(),
    supabase.from("orders").select("id, stripe_payment_intent_id")
      .eq("user_id", user.id).eq("status", "pending").not("stripe_payment_intent_id", "is", null),
  ]);

  type OfferRow = { id: string; user_id: string; product_id: string; quantity: number; offer_price: number; status: string };
  const products = (rawProducts ?? []) as Pick<Product, "id" | "name" | "price" | "images" | "inventory" | "is_published">[];
  const offerMap: Record<string, OfferRow> = Object.fromEntries(
    ((rawOffers ?? []) as OfferRow[]).map((o) => [o.id, o])
  );

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product || !product.is_published) return Response.json({ error: `Product not available` }, { status: 422 });
    if (product.inventory < item.quantity) return Response.json({ error: `Insufficient inventory for "${product.name}"` }, { status: 422 });
    if (item.offerId && !offerMap[item.offerId]) return Response.json({ error: `Offer for "${product.name}" is no longer valid` }, { status: 422 });
  }

  function resolvePrice(item: typeof items[number]): number {
    if (item.offerId && offerMap[item.offerId]) return Number(offerMap[item.offerId].offer_price);
    return Number(products.find((p) => p.id === item.productId)!.price);
  }

  const subtotal = items.reduce((sum, item) => sum + resolvePrice(item) * item.quantity, 0);
  const shippingCost = parseFloat(shippingRate.rate);

  let promoCode: string | null = null;
  let promoId: string | null = null;
  let discountAmount = 0;
  let shippingDiscount = 0;

  if (cartPromo) {
    const promoResult = await validatePromoCode(sb, (cartPromo as { promo_code: string }).promo_code, user.id, subtotal);
    if (promoResult.valid) {
      const promo = promoResult.promo;
      promoCode = promo.code;
      promoId = promo.id;
      const discount = calculatePromoDiscount(promo, subtotal, shippingCost, shippingAddress.country);
      discountAmount = discount.discountAmount;
      shippingDiscount = discount.shippingDiscount;
    }
  }

  const discountedSubtotal = subtotal - discountAmount;
  const effectiveShipping = shippingCost - shippingDiscount;
  const taxMode = settings?.tax_mode ?? "none";
  const taxFlatRate = Number(settings?.tax_flat_rate ?? 0);
  const { insuranceRequired, signatureRequired } = resolveShippingProtection(subtotal, settings);

  let taxAmount = 0;
  if (taxMode === "flat_rate" && taxFlatRate > 0) {
    taxAmount = discountedSubtotal * (taxFlatRate / 100);
  }

  // Total WITHOUT surcharge — deferred until card type is known after Payment Element
  const totalPrice = discountedSubtotal + effectiveShipping + taxAmount;

  // Cancel stale pending orders — but first check Stripe PI status so we don't cancel
  // an order that was just paid (webhook may not have arrived yet).
  if (pendingOrders && pendingOrders.length > 0) {
    type PendingOrder = { id: string; stripe_payment_intent_id: string };
    const withStatus = await Promise.all(
      (pendingOrders as PendingOrder[]).map(async (o) => {
        try {
          const pi = await stripe.paymentIntents.retrieve(o.stripe_payment_intent_id);
          return { ...o, piStatus: pi.status };
        } catch {
          return { ...o, piStatus: "unknown" as const };
        }
      })
    );
    // Only cancel PIs that haven't been charged; skip succeeded/processing ones
    const safeToCancel = withStatus.filter((o) =>
      ["requires_payment_method", "requires_confirmation", "requires_action", "unknown"].includes(o.piStatus)
    );
    if (safeToCancel.length > 0) {
      await supabase.from("orders").update({ status: "cancelled" }).in("id", safeToCancel.map((o) => o.id));
      Promise.all(safeToCancel.map((o) => stripe.paymentIntents.cancel(o.stripe_payment_intent_id).catch(() => {})));
    }
  }

  const { data: orderData, error: orderError } = await supabase
    .from("orders")
    .insert({
      user_id: user.id,
      status: "pending",
      subtotal,
      shipping_cost: shippingCost,
      tax_amount: taxAmount,
      total_price: totalPrice,
      promo_code: promoCode,
      promo_id: promoId,
      discount_amount: discountAmount,
      shipping_discount: shippingDiscount,
      selected_shipping_rate: shippingRate,
      insurance_required: insuranceRequired,
      signature_required: signatureRequired,
      surcharge_amount: 0,
      surcharge_percentage: 0,
      shipping_name: shippingAddress.name,
      shipping_address_line1: shippingAddress.address_line1,
      shipping_address_line2: shippingAddress.address_line2 ?? null,
      shipping_city: shippingAddress.city,
      shipping_state: shippingAddress.state,
      shipping_zip: shippingAddress.zip,
      shipping_country: shippingAddress.country,
    })
    .select("id")
    .single();

  if (orderError || !orderData) {
    console.error("Order insert error:", orderError);
    return Response.json({ error: "Failed to create order" }, { status: 500 });
  }

  const orderId = (orderData as { id: string }).id;
  const resolvedOfferIds = items.map((i) => i.offerId).filter((id): id is string => !!id && !!offerMap[id]);

  // Create Stripe PI (the slow external call)
  let intent: Awaited<ReturnType<typeof stripe.paymentIntents.create>>;
  try {
    intent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email ?? undefined,
      metadata: {
        order_id: orderId,
        ...(resolvedOfferIds.length > 0 ? { offer_ids: resolvedOfferIds.join(",") } : {}),
      },
    });
  } catch (err: any) {
    console.error("Stripe error:", err);
    await supabase.from("orders").delete().eq("id", orderId);
    return Response.json({ error: err?.message ?? "Failed to create payment intent" }, { status: 502 });
  }

  // Persist order_items and PI id in parallel (both needed for fulfillment + refund webhook)
  await Promise.all([
    supabase.from("order_items").insert(
      items.map((item) => ({
        order_id: orderId,
        product_id: item.productId,
        quantity: item.quantity,
        price: resolvePrice(item),
      }))
    ),
    supabase.from("orders").update({ stripe_payment_intent_id: intent.id }).eq("id", orderId),
  ]);

  return Response.json({ clientSecret: intent.client_secret, orderId, totalPrice });
}
