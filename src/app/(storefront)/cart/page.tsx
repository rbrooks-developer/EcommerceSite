"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/lib/cart/store";
import { formatPrice } from "@/lib/utils";
import { Trash2 } from "lucide-react";

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal, itemCount } = useCart();

  if (itemCount === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
        <p className="mb-8" style={{ opacity: 0.5 }}>Add some products to get started.</p>
        <Link
          href="/products"
          className="inline-block rounded-md px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)" }}
        >
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold mb-8">Your Cart</h1>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Items list */}
        <div className="flex-1 space-y-4">
          {items.map((item) => (
            <div
              key={item.productId}
              className="flex gap-4 rounded-lg p-4"
              style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)", backgroundColor: "var(--checkout-section-bg, color-mix(in srgb, var(--site-fg) 5%, var(--site-bg)))" }}
            >
              {item.image ? (
                <div className="relative h-20 w-20 shrink-0 rounded-md overflow-hidden">
                  <Image src={item.image} alt={item.name} fill className="object-contain" sizes="80px" />
                </div>
              ) : (
                <div className="h-20 w-20 shrink-0 rounded-md" style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 10%, var(--site-bg))" }} />
              )}

              <div className="flex-1 min-w-0">
                <Link
                  href={`/products/${item.productId}`}
                  className="font-medium hover:underline line-clamp-2 text-sm"
                >
                  {item.name}
                </Link>
                <p className="text-sm mt-0.5" style={{ opacity: 0.55 }}>{formatPrice(item.price * 100)} each</p>

                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center rounded-md overflow-hidden" style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 25%, transparent)" }}>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                      className="w-8 h-8 flex items-center justify-center text-sm transition-opacity hover:opacity-60"
                      aria-label="Decrease quantity"
                    >
                      −
                    </button>
                    <span className="w-8 text-center text-sm">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                      className="w-8 h-8 flex items-center justify-center text-sm transition-opacity hover:opacity-60"
                      aria-label="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId)}
                    className="p-1.5 transition-colors hover:text-red-500"
                    style={{ opacity: 0.45 }}
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <p className="shrink-0 font-semibold text-sm">
                {formatPrice(item.price * item.quantity * 100)}
              </p>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="lg:w-72 shrink-0">
          <div
            className="rounded-lg p-6 space-y-4 sticky top-24"
            style={{ border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)", backgroundColor: "var(--checkout-section-bg, color-mix(in srgb, var(--site-fg) 5%, var(--site-bg)))" }}
          >
            <h2 className="font-semibold">Order Summary</h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span style={{ opacity: 0.7 }}>Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
                <span>{formatPrice(subtotal * 100)}</span>
              </div>
              <div className="flex justify-between text-xs" style={{ opacity: 0.45 }}>
                <span>Shipping & tax</span>
                <span>Calculated at checkout</span>
              </div>
            </div>

            <div className="pt-4 flex justify-between font-semibold" style={{ borderTop: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)" }}>
              <span>Subtotal</span>
              <span>{formatPrice(subtotal * 100)}</span>
            </div>

            <Link
              href="/checkout"
              className="block w-full rounded-md py-3.5 text-center text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: "var(--site-fg)", backgroundClip: "border-box", WebkitBackgroundClip: "border-box", color: "var(--site-bg)", WebkitTextFillColor: "var(--site-bg)" }}
            >
              Proceed to Checkout
            </Link>

            <Link
              href="/products"
              className="block w-full rounded-md py-3.5 text-center text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ background: "var(--site-fg)", backgroundClip: "border-box", WebkitBackgroundClip: "border-box", color: "var(--site-bg)", WebkitTextFillColor: "var(--site-bg)" }}
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
