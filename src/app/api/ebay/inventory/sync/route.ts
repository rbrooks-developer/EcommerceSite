import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getValidEbayConfig, saveEbayConfig } from "@/lib/ebay/auth";
import { getEbayAvailableQty } from "@/lib/ebay/inventorySync";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic     = "force-dynamic";
export const maxDuration = 300;

export async function POST(_request: NextRequest): Promise<Response> {
  const auth = await requireAdmin();
  if (auth.error) {
    return new Response(JSON.stringify({ type: "fatal", message: "Unauthorized" }) + "\n", {
      status: 401,
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }

  const encoder = new TextEncoder();
  const stream  = new TransformStream<Uint8Array, Uint8Array>();
  const writer  = stream.writable.getWriter();

  const send = (data: object) =>
    writer.write(encoder.encode(JSON.stringify(data) + "\n"));

  // Run sync in the background so we can return the stream immediately
  (async () => {
    try {
      const config = await getValidEbayConfig();
      if (!config?.access_token) {
        await send({ type: "fatal", message: "eBay account not connected" });
        return;
      }

      const supabase = createServiceClient();
      const { data: products } = await supabase
        .from("products")
        .select("id, name, inventory, ebay_listing_id")
        .not("ebay_listing_id", "is", null);

      const items = (products ?? []) as {
        id: string; name: string; inventory: number; ebay_listing_id: string;
      }[];

      const total = items.length;
      await send({ type: "total", count: total });

      let updated = 0, zeroed = 0, unchanged = 0, errors = 0;

      for (let i = 0; i < items.length; i++) {
        const product = items[i];
        try {
          const ebayQty = await getEbayAvailableQty(product.ebay_listing_id, config);

          if (ebayQty === null) {
            if (product.inventory !== 0) {
              await supabase.from("products").update({ inventory: 0 }).eq("id", product.id);
              zeroed++;
              await send({ type: "item", current: i + 1, total, title: product.name, status: "zeroed" });
            } else {
              unchanged++;
              await send({ type: "item", current: i + 1, total, title: product.name, status: "unchanged" });
            }
          } else if (ebayQty !== product.inventory) {
            await supabase.from("products").update({ inventory: ebayQty }).eq("id", product.id);
            updated++;
            await send({ type: "item", current: i + 1, total, title: product.name, status: "updated" });
          } else {
            unchanged++;
            await send({ type: "item", current: i + 1, total, title: product.name, status: "unchanged" });
          }
        } catch (err: any) {
          errors++;
          await send({ type: "item", current: i + 1, total, title: product.name, status: "error", reason: err.message });
        }
      }

      await saveEbayConfig({ inventory_sync_last_run: new Date().toISOString() });
      await send({ type: "done", total, updated, zeroed, unchanged, errors });
    } catch (err) {
      const message = (err as Error).message;
      console.error("[ebay/inventory/sync] fatal", message);
      await send({ type: "fatal", message: message || "Sync failed" });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type":      "application/x-ndjson",
      "Cache-Control":      "no-cache",
      "X-Accel-Buffering":  "no",
    },
  });
}
