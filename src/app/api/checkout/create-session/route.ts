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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { items, shippingAddress, shippingRate } = parsed.data;

  // Fetch products from DB to validate availability
  const productIds = items.map((i) => i.productId);
  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, name, price, images, inventory, is_published")
    .in("id", productIds);

  const products = (rawProducts ?? []) as Pick<
    Product,
    "id" | "name" | "price" | "images" | "inventory" | "is_published"
  >[];

  // Fetch approved offers server-side for any offer items (never trust client price)
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

    offerMap = Object.fromEntries(
      ((rawOffers ?? []) as OfferRow[]).map((o) => [o.id, o])
    );
  }

  // Validate all items
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product || !product.is_published) {
      return Response.json({ error: `Product not available` }, { status: 422 });
    }
    if (product.inventory < item.quantity) {
      return Response.json(
        { error: `Insufficient inventory for "${product.name}"` },
        { status: 422 }
      );
    }
    if (item.offerId) {
      const offer = offerMap[item.offerId];
      if (!offer) {
        return Response.json(
          { error: `Offer for "${product.name}" is no longer valid` },
          { status: 422 }
        );
      }
    }
  }

  // Resolve the price per item: offer price if applicable, otherwise product price
  function resolvePrice(item: typeof items[number]): number {
    if (item.offerId && offerMap[item.offerId]) {
      return Number(offerMap[item.offerId].offer_price);
    }
    const product = products.find((p) => p.id === item.productId)!;
    return Number(product.price);
  }

  // Calculate totals using resolved prices
  const subtotal = items.reduce(
    (sum, item) => sum + resolvePrice(item) * item.quantity,
    0
  );

  const shippingCost = parseFloat(shippingRate.rate);

  // Read and validate any applied promo code
  const sb = createServiceClient();
  let promoCode: string | null = null;
  let promoId: string | null = null;
  let discountAmount = 0;
  let shippingDiscount = 0;

  const { data: cartPromo } = await sb
    .from("cart_promos")
    .select("promo_code")
    .eq("user_id", user.id)
    .maybeSingle();

  if (cartPromo) {
    const promoResult = await validatePromoCode(sb, (cartPromo as { promo_code: string }).promo_code, user.id, subtotal);
    if (promoResult.valid) {
      const promo = promoResult.promo;
      promoCode = promo.code;
      promoId = promo.id;
      const discount = calculatePromoDiscount(promo, subtotal, shippingCost);
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

  // Tax on discounted subtotal only (not shipping)
  let taxAmount = 0;
  if (taxMode === "flat_rate" && taxFlatRate > 0) {
    taxAmount = discountedSubtotal * (taxFlatRate / 100);
  }

  const totalPrice = discountedSubtotal + effectiveShipping + taxAmount;

  // Create pending order in DB
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

  // Insert order items using resolved prices
  const orderItems = items.map((item) => ({
    order_id: orderId,
    product_id: item.productId,
    quantity: item.quantity,
    price: resolvePrice(item),
  }));

  await supabase.from("order_items").insert(orderItems);

  type StripeLineItem = {
    price_data: { currency: string; product_data: { name: string; images?: string[] }; unit_amount: number };
    quantity: number;
  };

  // Build product line items at full price, then scale down if a merchandise discount applies
  let productLineItems: StripeLineItem[] = items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    const images = (product.images as string[]) ?? [];
    const unitPrice = resolvePrice(item);
    const isOffer = !!item.offerId && !!offerMap[item.offerId];
    return {
      price_data: {
        currency: "usd",
        product_data: {
          name: isOffer ? `${product.name} (Offer Price)` : product.name,
          ...(images[0] ? { images: [images[0]] } : {}),
        },
        unit_amount: Math.round(unitPrice * 100),
      },
      quantity: item.quantity,
    };
  });

  // Distribute merchandise discount proportionally across product line items
  if (discountAmount > 0) {
    const discountCents = Math.round(discountAmount * 100);
    const totalProductCents = productLineItems.reduce((s, i) => s + i.price_data.unit_amount * i.quantity, 0);
    if (totalProductCents > 0) {
      let used = 0;
      productLineItems = productLineItems.map((item, idx) => {
        const isLast = idx === productLineItems.length - 1;
        const itemTotal = item.price_data.unit_amount * item.quantity;
        const allot = isLast
          ? discountCents - used
          : Math.round(discountCents * (itemTotal / totalProductCents));
        used += allot;
        const perUnit = Math.floor(allot / item.quantity);
        return {
          ...item,
          price_data: {
            ...item.price_data,
            unit_amount: Math.max(0, item.price_data.unit_amount - perUnit),
          },
        };
      });
    }
  }

  // Shipping line item (reduced by shipping discount if applicable)
  const effectiveShippingCents = Math.max(0, Math.round(effectiveShipping * 100));

  const lineItems: StripeLineItem[] = [
    ...productLineItems,
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: promoCode && shippingDiscount > 0
            ? `Shipping – ${shippingRate.carrier} ${shippingRate.service} (${promoCode} applied)`
            : `Shipping – ${shippingRate.carrier} ${shippingRate.service}`,
        },
        unit_amount: effectiveShippingCents,
      },
      quantity: 1,
    },
  ];

  if (taxMode === "flat_rate" && taxAmount > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: `Tax (${taxFlatRate}%)` },
        unit_amount: Math.round(taxAmount * 100),
      },
      quantity: 1,
    });
  }

  const host   = request.headers.get("host") ?? "localhost:3000";
  const proto  = host.startsWith("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${proto}://${host}`;

  // Pass offer IDs in metadata so the webhook can mark them purchased
  // without relying on cart_items still existing at webhook time.
  const resolvedOfferIds = items
    .map((i) => i.offerId)
    .filter((id): id is string => !!id && !!offerMap[id]);

  const sessionParams = {
    mode: "payment" as const,
    line_items: lineItems,
    customer_email: user.email,
    metadata: {
      order_id: orderId,
      ...(resolvedOfferIds.length > 0
        ? { offer_ids: resolvedOfferIds.join(",") }
        : {}),
    },
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout`,
    ...(taxMode === "stripe" ? { automatic_tax: { enabled: true } } : {}),
  };

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create(sessionParams);

    // Save stripe_session_id on the order
    await supabase
      .from("orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderId);

    return Response.json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe error:", err);
    // Clean up pending order on Stripe failure
    await supabase.from("orders").delete().eq("id", orderId);
    return Response.json({ error: err?.message ?? "Failed to create payment session" }, { status: 502 });
  }
}
