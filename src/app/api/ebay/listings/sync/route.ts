import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { getValidEbayConfig } from "@/lib/ebay/auth";
import { runEbayListingSync } from "@/lib/ebay/listingSync";

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

  (async () => {
    try {
      const config = await getValidEbayConfig();
      if (!config?.access_token) {
        await send({ type: "fatal", message: "eBay account not connected" });
        return;
      }

      const result = await runEbayListingSync(config, {
        onFetching:  ()                          => send({ type: "fetching" }),
        onEnriching: (current, count)            => send({ type: "enriching", current, count }),
        onTotal:     (count)                     => send({ type: "total", count }),
        onItem:      (current, total, title, status, reason) =>
          send({ type: "item", current, total, title, status, ...(reason ? { reason } : {}) }),
      });

      await send({ type: "done", inserted: result.inserted, updated: result.updated, unchanged: result.unchanged, errors: result.errors });
    } catch (err) {
      const e = err as Error & { cause?: Error };
      const message = [e.message, e.cause?.message].filter(Boolean).join(" → ");
      console.error("[ebay/listings/sync] fatal", message, e.cause ?? e);
      await send({ type: "fatal", message: message || "Sync failed" });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      "Content-Type":      "application/x-ndjson",
      "Cache-Control":     "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}
