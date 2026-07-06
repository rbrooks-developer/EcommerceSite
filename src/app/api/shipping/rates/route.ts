import { NextRequest } from "next/server";
import { z } from "zod";
import { getEasyPostClient } from "@/lib/easypost/client";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { resolveSubtotal } from "@/lib/cart/pricing";
import { resolveShippingProtection, calculateInsuranceFee } from "@/lib/easypost/protection";
import { buildCustomsInfo } from "@/lib/easypost/customs";
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
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    offerId: z.string().nullable().optional(),
  })),
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
    .select("id, name, price, weight_oz, length_in, width_in, height_in, category_id, hs_tariff_number")
    .in("id", productIds);

  const products = (rawProducts ?? []) as Pick<
    Product,
    "id" | "name" | "price" | "weight_oz" | "length_in" | "width_in" | "height_in" | "category_id"
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
  const handlingFee = Number((settings as any)?.handling_fee ?? 0);

  if (!storeAddress?.street1) {
    return Response.json({ error: "Store shipping address not configured. Please update Site Settings." }, { status: 422 });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const subtotal = await resolveSubtotal(supabase, items, user?.id ?? null);
  const { insuranceRequired, signatureRequired } = resolveShippingProtection(subtotal, settings);
  const insuranceFee = calculateInsuranceFee(subtotal, insuranceRequired);

  const originCountry = storeAddress.country ?? "US";
  const isInternational = address.country !== originCountry;

  let hsTariffByCategory: Record<string, string | null> = {};
  let defaultHsTariff: string | null = null;
  if (isInternational) {
    const categoryIds = [...new Set(products.map((p) => (p as any).category_id).filter(Boolean))];
    const [catResult, settingsResult] = await Promise.all([
      categoryIds.length > 0
        ? supabase.from("categories").select("id, hs_tariff_number").in("id", categoryIds)
        : Promise.resolve({ data: [] }),
      supabase.from("site_settings").select("default_hs_tariff_number").eq("id", 1).single(),
    ]);
    hsTariffByCategory = Object.fromEntries((catResult.data ?? []).map((c: any) => [c.id, c.hs_tariff_number ?? null]));
    defaultHsTariff = (settingsResult.data as any)?.default_hs_tariff_number ?? null;
  }

  const customsInfo = isInternational
    ? buildCustomsInfo(
        items.flatMap((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return [];
          const hsTariffNumber =
            (product as any).hs_tariff_number ||
            hsTariffByCategory[(product as any).category_id] ||
            defaultHsTariff ||
            undefined;
          return [{
            description: product.name,
            quantity: item.quantity,
            weightOz: Number(product.weight_oz),
            unitValueUsd: Number(product.price),
            originCountry,
            hsTariffNumber,
          }];
        }),
        storeAddress.name,
      )
    : null;

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
      ...(customsInfo ? { customs_info: customsInfo } : {}),
      // Signature confirmation affects carrier pricing, so it must be set
      // before requesting rates — not applied after the fact at purchase time.
      ...(signatureRequired ? { options: { delivery_confirmation: "SIGNATURE" } } : {}),
    });

    const rates = (shipment.rates ?? []).map((r: any) => ({
      id: r.id,
      carrier: r.carrier,
      service: r.service,
      rate: (parseFloat(r.rate) + handlingFee + insuranceFee).toFixed(2),
      delivery_days: r.delivery_days ?? null,
      delivery_date: r.delivery_date ?? null,
    }));

    rates.sort((a: any, b: any) => parseFloat(a.rate) - parseFloat(b.rate));

    return Response.json({ rates, insuranceRequired, signatureRequired, insuranceFee: insuranceFee.toFixed(2) });
  } catch (err: any) {
    console.error("EasyPost error:", err);
    return Response.json(
      { error: err?.message ?? "Failed to fetch shipping rates" },
      { status: 502 }
    );
  }
}
