"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Use the service client for all cart mutations so RLS never blocks them.

export async function clearCartAction(): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const sb = createServiceClient();
  await Promise.all([
    sb.from("cart_items").delete().eq("user_id", user.id),
    sb.from("cart_promos").delete().eq("user_id", user.id),
  ]);
}

export async function removeCartItemAction(productId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const sb = createServiceClient();
  await sb.from("cart_items").delete().eq("user_id", user.id).eq("product_id", productId);
}

export type CartIssue = {
  name: string;
  issue: "removed" | "quantity_reduced";
  newQuantity?: number;
};

// Validates all DB cart items for the logged-in user. Auto-removes unavailable
// items and reduces quantities that exceed current inventory. Returns what changed.
export async function validateAndSyncCart(): Promise<{ valid: boolean; issues: CartIssue[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { valid: true, issues: [] };

  const { data: cartItems } = await supabase
    .from("cart_items")
    .select("product_id, quantity, name")
    .eq("user_id", user.id);

  if (!cartItems?.length) return { valid: true, issues: [] };

  const productIds = (cartItems as any[]).map(i => i.product_id as string);

  const { data: products } = await supabase
    .from("products")
    .select("id, inventory, is_published")
    .in("id", productIds);

  const productMap = Object.fromEntries(
    ((products ?? []) as { id: string; inventory: number; is_published: boolean }[]).map(p => [p.id, p])
  );

  const issues: CartIssue[] = [];
  const sb = createServiceClient();

  for (const item of cartItems as { product_id: string; quantity: number; name: string }[]) {
    const p = productMap[item.product_id];
    if (!p || !p.is_published || p.inventory === 0) {
      await sb.from("cart_items").delete().eq("user_id", user.id).eq("product_id", item.product_id);
      issues.push({ name: item.name, issue: "removed" });
    } else if (p.inventory < item.quantity) {
      await sb.from("cart_items").update({ quantity: p.inventory, updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("product_id", item.product_id);
      issues.push({ name: item.name, issue: "quantity_reduced", newQuantity: p.inventory });
    }
  }

  return { valid: issues.length === 0, issues };
}

// Server-side add-to-cart for regular products. Validates availability and
// existing cart quantity before upserting. Guest users return item data only
// (the client handles localStorage).
export async function addProductToCart(productId: string, quantity: number): Promise<{
  ok: boolean;
  error?: string;
  guestItem?: object; // returned for guests; client stores in localStorage
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: product } = await supabase
    .from("products")
    .select("id, slug, name, price, images, inventory, is_published, weight_oz, length_in, width_in, height_in")
    .eq("id", productId)
    .eq("is_published", true)
    .maybeSingle();

  if (!product) return { ok: false, error: "This product is no longer available." };

  const p = product as {
    id: string; slug: string; name: string; price: number; images: string[];
    inventory: number; weight_oz: number; length_in: number; width_in: number; height_in: number;
  };

  if (p.inventory === 0) return { ok: false, error: "This product is out of stock." };

  if (!user) {
    // Guest — return validated item for client-side localStorage
    if (quantity > p.inventory) return { ok: false, error: `Only ${p.inventory} available.` };
    return {
      ok: true,
      guestItem: {
        productId: p.id, slug: p.slug, name: p.name, price: Number(p.price), quantity,
        image: p.images?.[0] ?? null,
        weight_oz: Number(p.weight_oz), length_in: Number(p.length_in),
        width_in: Number(p.width_in), height_in: Number(p.height_in),
      },
    };
  }

  // Logged-in: check existing cart quantity
  const { data: existing } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .maybeSingle();

  const existingQty = (existing as { quantity: number } | null)?.quantity ?? 0;
  const totalQty = existingQty + quantity;

  if (totalQty > p.inventory) {
    const canAdd = p.inventory - existingQty;
    if (canAdd <= 0) return { ok: false, error: `You already have the maximum available (${p.inventory}) in your cart.` };
    return { ok: false, error: `You can only add ${canAdd} more — ${p.inventory} in stock, ${existingQty} already in cart.` };
  }

  const sb = createServiceClient();
  const { error } = await sb.from("cart_items").upsert({
    user_id: user.id, product_id: p.id, slug: p.slug, name: p.name,
    price: Number(p.price), quantity: totalQty,
    image: p.images?.[0] ?? null,
    weight_oz: Number(p.weight_oz), length_in: Number(p.length_in),
    width_in: Number(p.width_in), height_in: Number(p.height_in),
    offer_id: null, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,product_id" });

  if (error) return { ok: false, error: "Failed to add to cart. Please try again." };
  return { ok: true };
}
