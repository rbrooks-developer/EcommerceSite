"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/store";
import { addProductToCart } from "@/lib/actions/cart";
import type { Product } from "@/types";

type ProductProps = Pick<
  Product,
  "id" | "name" | "price" | "images" | "weight_oz" | "length_in" | "width_in" | "height_in" | "inventory"
>;

export function AddToCartButton({ product, favoriteSlot }: { product: ProductProps; favoriteSlot?: React.ReactNode }) {
  const router = useRouter();
  const { addItem, reloadCart } = useCart();
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "added" | "error" | "out_of_stock">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [liveInventory, setLiveInventory] = useState(product.inventory);

  async function handleAdd() {
    setStatus("loading");
    setErrorMsg(null);
    setWarningMsg(null);
    const result = await addProductToCart(product.id, qty);

    if (result.inventoryUpdated) {
      // eBay revealed a different inventory — refresh the page data
      router.refresh();
    }

    if (!result.ok) {
      // Check if the item is now out of stock based on the error message
      if (result.inventoryUpdated && result.error === "This item is no longer available.") {
        setLiveInventory(0);
        setStatus("out_of_stock");
      } else {
        setStatus("error");
        setErrorMsg(result.error ?? "Could not add to cart.");
        setTimeout(() => setStatus("idle"), 3000);
      }
      return;
    }

    if (result.guestItem) {
      addItem(result.guestItem as any);
    } else {
      await reloadCart();
    }

    if (result.warning) setWarningMsg(result.warning);
    setStatus("added");
    setTimeout(() => { setStatus("idle"); setWarningMsg(null); }, 5000);
  }

  const outOfStock = liveInventory === 0;

  if (outOfStock || status === "out_of_stock") {
    return (
      <div className="space-y-3">
        <div
          className="rounded-md px-4 py-2.5 text-sm font-semibold text-center"
          style={{ backgroundColor: "color-mix(in srgb, #ef4444 12%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 35%, transparent)", color: "#ef4444", WebkitTextFillColor: "#ef4444" }}
        >
          Out of Stock
        </div>
        {favoriteSlot}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-sm" style={{ opacity: 0.6 }}>Qty</span>
        <div
          className="flex items-center rounded-md overflow-hidden"
          style={{ border: "1px solid currentColor", opacity: 0.85 }}
        >
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-10 h-10 flex items-center justify-center transition-opacity hover:opacity-60"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <span className="w-10 text-center text-sm font-medium">{qty}</span>
          <button
            onClick={() => setQty((q) => Math.min(liveInventory, q + 1))}
            className="w-10 h-10 flex items-center justify-center transition-opacity hover:opacity-60"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <span className="text-xs" style={{ opacity: 0.45 }}>{liveInventory} available</span>
        {favoriteSlot}
      </div>

      {errorMsg && (
        <p className="text-xs" style={{ color: "#ef4444", WebkitTextFillColor: "#ef4444" }}>{errorMsg}</p>
      )}
      {warningMsg && (
        <p className="text-xs" style={{ color: "#d97706", WebkitTextFillColor: "#d97706" }}>{warningMsg}</p>
      )}

      <button
        onClick={handleAdd}
        disabled={status === "loading"}
        className="w-full rounded-md py-4 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
        style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)" }}
      >
        {status === "loading" ? "Adding…" : status === "added" ? "Added to Cart!" : "Add to Cart"}
      </button>
    </div>
  );
}
