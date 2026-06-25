"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CartItem } from "@/types";

const GUEST_KEY = "ec_cart_guest";

interface CartContextValue {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  itemCount: number;
  subtotal: number;
}

const CartContext = createContext<CartContextValue | null>(null);

function toCartItem(row: Record<string, unknown>): CartItem {
  return {
    productId:  String(row.product_id),
    name:       String(row.name),
    price:      Number(row.price),
    quantity:   Number(row.quantity),
    image:      row.image ? String(row.image) : null,
    weight_oz:  Number(row.weight_oz ?? 0),
    length_in:  Number(row.length_in ?? 0),
    width_in:   Number(row.width_in ?? 0),
    height_in:  Number(row.height_in ?? 0),
  };
}

function toRow(userId: string, item: CartItem) {
  return {
    user_id:    userId,
    product_id: item.productId,
    name:       item.name,
    price:      item.price,
    quantity:   item.quantity,
    image:      item.image ?? null,
    weight_oz:  item.weight_oz,
    length_in:  item.length_in,
    width_in:   item.width_in,
    height_in:  item.height_in,
    updated_at: new Date().toISOString(),
  };
}

export function CartProvider({ userId, children }: { userId?: string | null; children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const sb = useRef(createClient()).current;

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (userId) {
        // Grab any guest items to merge in
        let guestItems: CartItem[] = [];
        try {
          const raw = localStorage.getItem(GUEST_KEY);
          if (raw) guestItems = JSON.parse(raw);
        } catch {}

        // Fetch DB cart
        const { data } = await sb.from("cart_items").select("*").eq("user_id", userId);
        if (cancelled) return;

        const dbItems: CartItem[] = (data ?? []).map(toCartItem);

        // Merge guest items into DB items
        if (guestItems.length > 0) {
          const merged = [...dbItems];
          for (const g of guestItems) {
            const ex = merged.find(i => i.productId === g.productId);
            if (ex) {
              ex.quantity += g.quantity;
            } else {
              merged.push(g);
            }
          }
          // Upsert merged rows
          await sb.from("cart_items").upsert(
            merged.map(item => toRow(userId, item)),
            { onConflict: "user_id,product_id" }
          );
          localStorage.removeItem(GUEST_KEY);
          if (!cancelled) setItems(merged);
        } else {
          if (!cancelled) setItems(dbItems);
        }
      } else {
        // Guest — localStorage only
        try {
          const raw = localStorage.getItem(GUEST_KEY);
          if (!cancelled) setItems(raw ? JSON.parse(raw) : []);
        } catch {
          if (!cancelled) setItems([]);
        }
      }

      if (!cancelled) setLoaded(true);
    };

    setLoaded(false);
    load();
    return () => { cancelled = true; };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist guest cart to localStorage
  useEffect(() => {
    if (!userId && loaded) {
      try { localStorage.setItem(GUEST_KEY, JSON.stringify(items)); } catch {}
    }
  }, [items, userId, loaded]);

  const addItem = useCallback((newItem: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === newItem.productId);
      const next = existing
        ? prev.map(i => i.productId === newItem.productId ? { ...i, quantity: i.quantity + newItem.quantity } : i)
        : [...prev, newItem];

      if (userId) {
        const upserted = next.find(i => i.productId === newItem.productId)!;
        sb.from("cart_items").upsert(toRow(userId, upserted), { onConflict: "user_id,product_id" });
      }
      return next;
    });
  }, [userId, sb]);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => {
      if (userId) sb.from("cart_items").delete().eq("user_id", userId).eq("product_id", productId);
      return prev.filter(i => i.productId !== productId);
    });
  }, [userId, sb]);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => {
        if (userId) sb.from("cart_items").delete().eq("user_id", userId).eq("product_id", productId);
        return prev.filter(i => i.productId !== productId);
      });
    } else {
      setItems(prev => {
        const next = prev.map(i => i.productId === productId ? { ...i, quantity } : i);
        if (userId) {
          const updated = next.find(i => i.productId === productId);
          if (updated) sb.from("cart_items").upsert(toRow(userId, updated), { onConflict: "user_id,product_id" });
        }
        return next;
      });
    }
  }, [userId, sb]);

  const clearCart = useCallback(() => {
    setItems([]);
    if (userId) sb.from("cart_items").delete().eq("user_id", userId);
  }, [userId, sb]);

  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const subtotal  = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, itemCount, subtotal }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
