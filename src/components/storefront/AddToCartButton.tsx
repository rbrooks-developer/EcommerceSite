"use client";

import { useState } from "react";
import { useCart } from "@/lib/cart/store";
import { addProductToCart } from "@/lib/actions/cart";
import type { Product } from "@/types";

type ProductProps = Pick<
  Product,
  "id" | "name" | "price" | "images" | "weight_oz" | "length_in" | "width_in" | "height_in" | "inventory"
>;

export function AddToCartButton({ product, favoriteSlot }: { product: ProductProps; favoriteSlot?: React.ReactNode }) {
  const { addItem, reloadCart } = useCart();
  const [qty, setQty] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "added" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAdd() {
    setStatus("loading");
    setErrorMsg(null);
    const result = await addProductToCart(product.id, qty);

    if (!result.ok) {
      setStatus("error");
      setErrorMsg(result.error ?? "Could not add to cart.");
      setTimeout(() => setStatus("idle"), 3000);
      return;
    }

    if (result.guestItem) {
      // Guest user — validated server-side, add to local cart
      addItem(result.guestItem as any);
    } else {
      // Logged-in — item written to DB; sync context
      await reloadCart();
    }

    setStatus("added");
    setTimeout(() => setStatus("idle"), 2000);
  }

  if (product.inventory === 0) {
    return (
      <div className="space-y-3">
        <button
          disabled
          className="w-full rounded-md py-4 text-sm font-semibold cursor-not-allowed"
          style={{ opacity: 0.35, border: "1px solid currentColor" }}
        >
          Out of Stock
        </button>
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
            onClick={() => setQty((q) => Math.min(product.inventory, q + 1))}
            className="w-10 h-10 flex items-center justify-center transition-opacity hover:opacity-60"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
        <span className="text-xs" style={{ opacity: 0.45 }}>{product.inventory} available</span>
        {favoriteSlot}
      </div>

      {errorMsg && (
        <p className="text-xs" style={{ color: "#ef4444", WebkitTextFillColor: "#ef4444" }}>{errorMsg}</p>
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
