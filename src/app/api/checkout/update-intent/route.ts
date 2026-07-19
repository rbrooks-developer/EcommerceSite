import { NextRequest } from "next/server";
import { z } from "zod";
import { getStripeClient } from "@/lib/stripe/client";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import type { SurchargeConfig } from "@/types";

const schema = z.object({
  intentId: z.string().startsWith("pi_"),
  orderId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });

  const { intentId, orderId } = parsed.data;

  const { data: orderRaw } = await supabase
    .from("orders")
    .select("id, user_id, subtotal, discount_amount, total_price, surcharge_amount, stripe_payment_intent_id, status")
    .eq("id", orderId)
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!orderRaw) return Response.json({ error: "Order not found" }, { status: 404 });

  const order = orderRaw as {
    id: string;
    user_id: string;
    subtotal: number;
    discount_amount: number;
    total_price: number;
    surcharge_amount: number | null;
    stripe_payment_intent_id: string | null;
    status: string;
  };

  if (order.stripe_payment_intent_id !== intentId) {
    return Response.json({ error: "Intent mismatch" }, { status: 403 });
  }

  const settings = await getSettings();
  const surchargeCfg = (settings as any)?.surcharge_config as SurchargeConfig | null;

  if (!surchargeCfg?.surcharge_active || !surchargeCfg.surcharge_percent) {
    return Response.json({ surchargeAmount: 0, surchargePercentage: 0, newTotal: Number(order.total_price) });
  }

  const discountedSubtotal = Number(order.subtotal) - Number(order.discount_amount);
  const orderTotal = Number(order.total_price); // subtotal + shipping + tax, before surcharge
  const minOrder = surchargeCfg.surcharge_min_order ?? 0;
  if (minOrder > 0 && orderTotal < minOrder) {
    return Response.json({ surchargeAmount: 0, surchargePercentage: 0, newTotal: orderTotal });
  }

  const surchargePercent = Math.min(surchargeCfg.surcharge_percent, 4);
  const surchargeAmount = Math.round(discountedSubtotal * surchargePercent / 100 * 100) / 100;
  // Subtract any previously applied surcharge so it's never stacked on itself
  const baseTotal = Number(order.total_price) - Number(order.surcharge_amount ?? 0);
  const newTotal = baseTotal + surchargeAmount;

  const stripe = getStripeClient();
  await stripe.paymentIntents.update(intentId, {
    amount: Math.round(newTotal * 100),
  });

  await supabase
    .from("orders")
    .update({
      surcharge_amount: surchargeAmount,
      surcharge_percentage: surchargePercent,
      total_price: newTotal,
    })
    .eq("id", orderId);

  return Response.json({ surchargeAmount, surchargePercentage: surchargePercent, newTotal });
}
