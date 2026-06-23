import { NextRequest } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import type { Product } from "@/types";

const requestSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
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

  // Fetch products from DB to validate prices + inventory
  const productIds = items.map((i) => i.productId);
  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, name, price, images, inventory, is_published")
    .in("id", productIds);

  const products = (rawProducts ?? []) as Pick<
    Product,
    "id" | "name" | "price" | "images" | "inventory" | "is_published"
  >[];

  // Validate all items are published and in stock
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
  }

  // Calculate totals from DB prices (never trust client)
  const subtotal = items.reduce((sum, item) => {
    const product = products.find((p) => p.id === item.productId)!;
    return sum + Number(product.price) * item.quantity;
  }, 0);

  const shippingCost = parseFloat(shippingRate.rate);

  const settings = await getSettings();
  const taxMode = settings?.tax_mode ?? "none";
  const taxFlatRate = Number(settings?.tax_flat_rate ?? 0);

  let taxAmount = 0;
  if (taxMode === "flat_rate" && taxFlatRate > 0) {
    taxAmount = (subtotal + shippingCost) * (taxFlatRate / 100);
  }

  const totalPrice = subtotal + shippingCost + taxAmount;

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
      selected_shipping_rate: shippingRate,
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

  // Insert order items
  const orderItems = items.map((item) => {
    const product = products.find((p) => p.id === item.productId)!;
    return {
      order_id: orderId,
      product_id: item.productId,
      quantity: item.quantity,
      price: Number(product.price),
    };
  });

  await supabase.from("order_items").insert(orderItems);

  type StripeLineItem = {
    price_data: { currency: string; product_data: { name: string; images?: string[] }; unit_amount: number };
    quantity: number;
  };

  // Build Stripe line items
  const lineItems: StripeLineItem[] = [
    ...items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const images = (product.images as string[]) ?? [];
      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            ...(images[0] ? { images: [images[0]] } : {}),
          },
          unit_amount: Math.round(Number(product.price) * 100),
        },
        quantity: item.quantity,
      };
    }),
    {
      price_data: {
        currency: "usd",
        product_data: {
          name: `Shipping – ${shippingRate.carrier} ${shippingRate.service}`,
        },
        unit_amount: Math.round(shippingCost * 100),
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const sessionParams = {
    mode: "payment" as const,
    line_items: lineItems,
    customer_email: user.email,
    metadata: { order_id: orderId },
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
