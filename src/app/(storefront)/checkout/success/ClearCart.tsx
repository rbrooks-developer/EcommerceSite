"use client";

import { useEffect } from "react";
import { useCart } from "@/lib/cart/store";

export function ClearCart() {
  const { clearCart } = useCart();
  useEffect(() => {
    clearCart();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
