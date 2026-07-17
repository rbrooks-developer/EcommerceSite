import { NextRequest } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(["klarna", "amazon_pay"]),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { orderId, method } = parsed.data;

  const { data: orderRaw } = await supabase
    .from("orders")
    .select("id, user_id, total_price, surcharge_amount, stripe_payment_intent_id, status")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!orderRaw) return Response.json({ error: "Order not found" }, { status: 404 });

  const order = orderRaw as {
    id: string;
    user_id: string;
    total_price: number;
    surcharge_amount: number | null;
    stripe_payment_intent_id: string | null;
    status: string;
  };

  const stripe = getStripeClient();

  if (order.stripe_payment_intent_id) {
    try { await stripe.paymentIntents.cancel(order.stripe_payment_intent_id); } catch {}
  }

  // Use base total (strip any credit card surcharge that may have been added)
  const baseTotal = Number(order.total_price) - Number(order.surcharge_amount ?? 0);

  const intent = await stripe.paymentIntents.create({
    amount: Math.round(baseTotal * 100),
    currency: "usd",
    payment_method_types: [method],
    receipt_email: user.email ?? undefined,
    metadata: { order_id: orderId },
  });

  await supabase
    .from("orders")
    .update({
      stripe_payment_intent_id: intent.id,
      total_price: baseTotal,
      surcharge_amount: 0,
      surcharge_percentage: 0,
    })
    .eq("id", orderId);

  return Response.json({ clientSecret: intent.client_secret });
}
