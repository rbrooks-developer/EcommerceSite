import { NextRequest } from "next/server";
import { z } from "zod";
import { getEasyPostClient } from "@/lib/easypost/client";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import type { Product, StoreAddress } from "@/types";

const requestSchema = z.object({
  address: z.object({
    name: z.string(),
    address_line1: z.string(),
    address_line2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    country: z.string().default("US"),
  }),
  items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive() })),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { address, items } = parsed.data;

  const supabase = await createClient();
  const productIds = items.map((i) => i.productId);
  const { data: rawProducts } = await supabase
    .from("products")
    .select("id, weight_oz, length_in, width_in, height_in")
    .in("id", productIds);

  const products = (rawProducts ?? []) as Pick<
    Product,
    "id" | "weight_oz" | "length_in" | "width_in" | "height_in"
  >[];

  if (products.length === 0) {
    return Response.json({ error: "Products not found" }, { status: 404 });
  }

  let totalWeightOz = 0;
  let maxLength = 0;
  let maxWidth = 0;
  let maxHeight = 0;

  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    totalWeightOz += Number(product.weight_oz) * item.quantity;
    maxLength = Math.max(maxLength, Number(product.length_in));
    maxWidth = Math.max(maxWidth, Number(product.width_in));
    maxHeight = Math.max(maxHeight, Number(product.height_in));
  }

  const settings = await getSettings();
  const storeAddress = settings?.store_address as StoreAddress | null;

  if (!storeAddress?.street1) {
    return Response.json({ error: "Store shipping address not configured. Please update Site Settings." }, { status: 422 });
  }

  try {
    const shipment = await (getEasyPostClient() as any).Shipment.create({
      to_address: {
        name: address.name,
        street1: address.address_line1,
        street2: address.address_line2 ?? "",
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country,
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

    const rates = (shipment.rates ?? []).map((r: any) => ({
      id: r.id,
      carrier: r.carrier,
      service: r.service,
      rate: r.rate,
      delivery_days: r.delivery_days ?? null,
      delivery_date: r.delivery_date ?? null,
    }));

    rates.sort((a: any, b: any) => parseFloat(a.rate) - parseFloat(b.rate));

    return Response.json({ rates });
  } catch (err: any) {
    console.error("EasyPost error:", err);
    return Response.json(
      { error: err?.message ?? "Failed to fetch shipping rates" },
      { status: 502 }
    );
  }
}
