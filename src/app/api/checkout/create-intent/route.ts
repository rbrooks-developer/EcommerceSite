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
      productId: z.string(),
      quantity: z.number().int().positive(),
      offerId: z.string().nullable().optional(),
    })
  ),
  shippingAddress: z.object({
    name: z.string(),
    address_line1: z.string(),
    address_line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string(),
  }),
  shippingRate: z.object({
    id: z.string(),
    carrier: z.string(),
    service: z.string(),
    rate: z.string(),
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
  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, name, price, images, inventory, is_published")
    .in("id", productIds);

  const products = (rawProducts ?? []) as Pick<Product, "id" | "name" | "price" | "images" | "inventory" | "is_published">[];

  const offerIds = items.map((i) => i.offerId).filter(Boolean) as string[];
  type OfferRow = { id: string; user_id: string; product_id: string; quantity: number; offer_price: number; status: string };
  let offerMap: Record<string, OfferRow> = {};

  if (offerIds.length > 0) {
    const { data: rawOffers } = await supabase
      .from("product_offers")
      .select("id, user_id, product_id, quantity, offer_price, status")
      .in("id", offerIds)
      .eq("user_id", user.id)
      .eq("status", "approved");
    offerMap = Object.fromEntries(((rawOffers ?? []) as OfferRow[]).map((o) => [o.id, o]));
  }

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

  const sb = createServiceClient();
  let promoCode: string | null = null;
  let promoId: string | null = null;
  let discountAmount = 0;
  let shippingDiscount = 0;

  const { data: cartPromo } = await sb.from("cart_promos").select("promo_code").eq("user_id", user.id).maybeSingle();
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

  const settings = await getSettings();
  const taxMode = settings?.tax_mode ?? "none";
  const taxFlatRate = Number(settings?.tax_flat_rate ?? 0);
  const { insuranceRequired, signatureRequired } = resolveShippingProtection(subtotal, settings);

  let taxAmount = 0;
  if (taxMode === "flat_rate" && taxFlatRate > 0) {
    taxAmount = discountedSubtotal * (taxFlatRate / 100);
  }

  // Total WITHOUT surcharge — deferred until card type is known after Payment Element
  const totalPrice = discountedSubtotal + effectiveShipping + taxAmount;

  // Cancel any abandoned pending PaymentIntent orders for this user
  const stripe = getStripeClient();
  const { data: pendingOrders } = await supabase
    .from("orders")
    .select("id, stripe_payment_intent_id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .not("stripe_payment_intent_id", "is", null);

  if (pendingOrders && pendingOrders.length > 0) {
    await Promise.all(
      (pendingOrders as { id: string; stripe_payment_intent_id: string }[]).map(async (o) => {
        try { await stripe.paymentIntents.cancel(o.stripe_payment_intent_id); } catch {}
        await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
      })
    );
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

  await supabase.from("order_items").insert(
    items.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      quantity: item.quantity,
      price: resolvePrice(item),
    }))
  );

  const resolvedOfferIds = items.map((i) => i.offerId).filter((id): id is string => !!id && !!offerMap[id]);

  try {
    const intent = await stripe.paymentIntents.create({
      amount: Math.round(totalPrice * 100),
      currency: "usd",
      payment_method_types: ["card"],
      receipt_email: user.email ?? undefined,
      metadata: {
        order_id: orderId,
        ...(resolvedOfferIds.length > 0 ? { offer_ids: resolvedOfferIds.join(",") } : {}),
      },
    });

    await supabase.from("orders").update({ stripe_payment_intent_id: intent.id }).eq("id", orderId);

    return Response.json({ clientSecret: intent.client_secret, orderId, totalPrice });
  } catch (err: any) {
    console.error("Stripe error:", err);
    await supabase.from("orders").delete().eq("id", orderId);
    return Response.json({ error: err?.message ?? "Failed to create payment intent" }, { status: 502 });
  }
}
