"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { revalidatePath, refresh } from "next/cache";
import { sendOfferReceived } from "@/lib/emails/offerReceived";
import { sendOfferApproved } from "@/lib/emails/offerApproved";
import { sendOfferDeclined } from "@/lib/emails/offerDeclined";
import { sendOfferCountered } from "@/lib/emails/offerCountered";
import { getSettings } from "@/lib/data/settings";
import { FROM_EMAIL } from "@/lib/resend/client";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import type { HomepageConfig, FooterConfig } from "@/types";

async function getDisplayName() {
  const settings = await getSettings();
  const homepage = settings?.homepage_config as HomepageConfig | null;
  const footer   = settings?.footer_config   as FooterConfig   | null;
  return homepage?.hero_display_name || footer?.display_name || settings?.site_title || "My Store";
}

export async function submitOffer(productId: string, quantity: number, offerPrice: number) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in to make an offer" };

  const { data: product } = await supabase
    .from("products")
    .select("id, name, price, inventory, is_published")
    .eq("id", productId)
    .eq("is_published", true)
    .maybeSingle();

  if (!product) return { error: "Product not found" };
  if (product.inventory < 1) return { error: "This product is out of stock" };
  if (offerPrice >= Number(product.price)) return { error: "Offer must be less than the list price" };
  if (quantity < 1) return { error: "Quantity must be at least 1" };
  if (quantity > product.inventory) return { error: `Only ${product.inventory} unit${product.inventory === 1 ? "" : "s"} available` };

  const MAX_OFFERS = 4;

  // Block if an active offer already exists (pending, approved, or being countered)
  const { data: existing } = await supabase
    .from("product_offers")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .in("status", ["pending", "approved", "countered"])
    .maybeSingle();

  if (existing) {
    return {
      error: existing.status === "pending"
        ? "You already have a pending offer on this product"
        : existing.status === "countered"
        ? "You have a counter offer awaiting your response — check My Offers"
        : "You already have an approved offer on this product — check My Offers",
    };
  }

  // Enforce per-product offer limit — each counter-back also consumes a slot via user_counter_count
  const { data: offerRows } = await supabase
    .from("product_offers")
    .select("user_counter_count")
    .eq("user_id", user.id)
    .eq("product_id", productId)
    .in("status", ["pending", "approved", "declined", "purchased", "out_of_stock", "countered"]);

  const count = (offerRows ?? []).reduce(
    (sum: number, r: any) => sum + 1 + (r.user_counter_count ?? 0), 0
  );

  if (count >= MAX_OFFERS) {
    return { error: `You've reached the maximum of ${MAX_OFFERS} offers for this product` };
  }

  const { error: insertError } = await supabase
    .from("product_offers")
    .insert({ user_id: user.id, product_id: productId, quantity, offer_price: offerPrice });

  if (insertError) {
    console.error("submitOffer:", insertError.message);
    return { error: "Failed to submit offer. Please try again." };
  }

  // Notify admin of new offer
  const { data: profile } = await supabase.from("profiles").select("email").eq("id", user.id).maybeSingle();
  const customerEmail = (profile as { email: string } | null)?.email ?? user.email ?? "";
  const settings = await getSettings();
  const adminEmail = (settings?.contact_info as any)?.email as string | null | undefined;
  const notifyTo   = adminEmail || FROM_EMAIL;
  const displayName = await getDisplayName();
  const appUrl      = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  sendOfferReceived({ to: notifyTo, productName: product.name, quantity, offerPrice, displayName, customerEmail, appUrl })
    .catch(err => console.error("offerReceived email:", err));

  revalidatePath(`/products/${product.id}`);
  revalidatePath("/account");
  refresh();
  return { success: true };
}

export async function approveOffer(offerId: string) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };
  const sb = createServiceClient();

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);

  const { data: offer, error } = await sb
    .from("product_offers")
    .update({ status: "approved", expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .select("*, products(name)")
    .single();

  if (error) { console.error("approveOffer:", error.message); return { error: "Failed to approve offer" }; }

  const { data: profile } = await sb.from("profiles").select("email").eq("id", offer.user_id).maybeSingle();
  const customerEmail = (profile as { email: string } | null)?.email;
  if (customerEmail) {
    const displayName = await getDisplayName();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    sendOfferApproved({
      to: customerEmail,
      productName: (offer.products as any)?.name ?? "Product",
      quantity: offer.quantity,
      offerPrice: Number(offer.offer_price),
      expiresAt,
      displayName,
      appUrl,
    }).catch(err => console.error("offerApproved email:", err));
  }

  revalidatePath("/admin/offers");
  refresh();
  return { success: true };
}

export async function declineOffer(offerId: string, reason?: string) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };
  const sb = createServiceClient();

  const { data: offer, error } = await sb
    .from("product_offers")
    .update({ status: "declined", decline_reason: reason ?? null, updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .select("*, products(name)")
    .single();

  if (error) { console.error("declineOffer:", error.message); return { error: "Failed to decline offer" }; }

  const { data: profile } = await sb.from("profiles").select("email").eq("id", offer.user_id).maybeSingle();
  const customerEmail = (profile as { email: string } | null)?.email;
  if (customerEmail) {
    const displayName = await getDisplayName();
    sendOfferDeclined({
      to: customerEmail,
      productName: (offer.products as any)?.name ?? "Product",
      quantity: offer.quantity,
      offerPrice: Number(offer.offer_price),
      reason: reason ?? null,
      displayName,
    }).catch(err => console.error("offerDeclined email:", err));
  }

  revalidatePath("/admin/offers");
  refresh();
  return { success: true };
}

export async function deleteOffer(offerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("product_offers")
    .delete()
    .eq("id", offerId)
    .eq("user_id", user.id);

  if (error) return { error: error.message };
  revalidatePath("/account");
  refresh();
  return { success: true };
}

export async function adminDeleteOffer(offerId: string) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };
  const sb = createServiceClient();
  const { error } = await sb.from("product_offers").delete().eq("id", offerId);
  if (error) { console.error("adminDeleteOffer:", error.message); return { error: "Failed to delete offer" }; }
  revalidatePath("/admin/offers");
  refresh();
  return { success: true };
}

export async function counterOffer(offerId: string, counterPrice: number) {
  const auth = await requireAdmin();
  if (auth.error) return { error: auth.error };
  const sb = createServiceClient();

  const { data: offer, error } = await sb
    .from("product_offers")
    .update({ status: "countered", counter_price: counterPrice, updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .select("*, products(name)")
    .single();

  if (error) { console.error("counterOffer:", error.message); return { error: "Failed to send counter offer" }; }

  const { data: profile } = await sb.from("profiles").select("email").eq("id", offer.user_id).maybeSingle();
  const customerEmail = (profile as { email: string } | null)?.email;
  if (customerEmail) {
    const displayName = await getDisplayName();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    sendOfferCountered({
      to: customerEmail,
      productName: (offer.products as any)?.name ?? "Product",
      originalPrice: Number(offer.offer_price),
      counterPrice,
      displayName,
      appUrl,
    }).catch(err => console.error("offerCountered email:", err));
  }

  revalidatePath("/admin/offers");
  refresh();
  return { success: true };
}

// Customer accepts the admin's counter price — approves at counter_price with expiry.
export async function acceptCounter(offerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sb = createServiceClient();

  const { data: offer } = await sb
    .from("product_offers")
    .select("id, user_id, quantity, counter_price, products(name)")
    .eq("id", offerId)
    .eq("user_id", user.id)
    .eq("status", "countered")
    .maybeSingle();

  if (!offer || !(offer as any).counter_price) return { error: "Offer not found" };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 3);

  const { error } = await sb
    .from("product_offers")
    .update({
      status: "approved",
      offer_price: (offer as any).counter_price,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", offerId);

  if (error) return { error: "Failed to accept counter offer" };

  revalidatePath("/account");
  refresh();
  return { success: true };
}

// Customer declines the admin's counter — marks declined.
export async function declineCounter(offerId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sb = createServiceClient();

  const { error } = await sb
    .from("product_offers")
    .update({ status: "declined", updated_at: new Date().toISOString() })
    .eq("id", offerId)
    .eq("user_id", user.id)
    .eq("status", "countered");

  if (error) { console.error("declineCounter:", error.message); return { error: "Failed to decline counter offer" }; }

  revalidatePath("/account");
  refresh();
  return { success: true };
}

// Customer sends back their own counter price — resets to pending so admin sees it again.
// Increments user_counter_count so each counter-back consumes an offer slot toward the 4-offer limit.
export async function userCounterBack(offerId: string, newOfferPrice: number) {
  if (newOfferPrice <= 0) return { error: "Counter price must be greater than $0" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const sb = createServiceClient();

  // Verify the offer belongs to this user and is in countered state
  const { data: offer, error: fetchErr } = await sb
    .from("product_offers")
    .select("id, user_id, product_id, quantity, status")
    .eq("id", offerId)
    .eq("user_id", user.id)
    .eq("status", "countered")
    .maybeSingle();

  if (fetchErr) { console.error("userCounterBack fetch:", fetchErr.message); return { error: "Failed to load offer" }; }
  if (!offer) return { error: "Offer not found or already responded to" };

  // Fetch product for validation and email
  const { data: product } = await sb
    .from("products")
    .select("price, name")
    .eq("id", (offer as any).product_id)
    .maybeSingle();

  const listPrice = Number((product as any)?.price ?? 0);
  if (listPrice > 0 && newOfferPrice >= listPrice) {
    return { error: `Counter price must be less than the list price ($${listPrice.toFixed(2)})` };
  }

  // Fetch current counter count so we can increment it
  const { data: current } = await sb
    .from("product_offers")
    .select("user_counter_count")
    .eq("id", offerId)
    .maybeSingle();

  const newCount = ((current as any)?.user_counter_count ?? 0) + 1;

  const { error: updateErr } = await sb
    .from("product_offers")
    .update({
      offer_price: newOfferPrice,
      counter_price: null,
      status: "pending",
      user_counter_count: newCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", offerId)
    .eq("user_id", user.id);

  if (updateErr) { console.error("userCounterBack update:", updateErr.message); return { error: "Failed to submit counter offer" }; }

  // Notify admin of the customer's counter
  const { data: profileRow } = await sb.from("profiles").select("email").eq("id", user.id).maybeSingle();
  const customerEmail = (profileRow as { email: string } | null)?.email ?? user.email ?? "";
  const settings2     = await getSettings();
  const adminEmail2   = (settings2?.contact_info as any)?.email as string | null | undefined;
  const notifyTo2     = adminEmail2 || FROM_EMAIL;
  const displayName2  = await getDisplayName();
  const appUrl2       = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const productName   = (product as any)?.name ?? "Product";
  const qty           = (offer as any)?.quantity ?? 1;
  sendOfferReceived({
    to: notifyTo2,
    productName,
    quantity: qty,
    offerPrice: newOfferPrice,
    displayName: displayName2,
    customerEmail,
    appUrl: appUrl2,
  }).catch(err => console.error("userCounterBack admin email:", err));

  revalidatePath("/account");
  revalidatePath("/admin/offers");
  refresh();
  return { success: true };
}

export async function markOfferPurchased(offerId: string) {
  const sb = createServiceClient();
  await sb
    .from("product_offers")
    .update({ status: "purchased", updated_at: new Date().toISOString() })
    .eq("id", offerId);
  revalidatePath("/account");
}

// Checks inventory and, if sufficient, inserts the offer item directly into
// cart_items so the DB write is complete before the client navigates to /cart.
export async function addOfferToCart(offerId: string): Promise<{ ok: boolean; item?: {
  productId: string; name: string; price: number; quantity: number;
  image: string | null; weight_oz: number; length_in: number;
  width_in: number; height_in: number; offerId: string;
} }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  const sb = createServiceClient();

  const { data: offerRaw, error: offerErr } = await sb
    .from("product_offers")
    .select("id, product_id, quantity, offer_price, status, products(id, slug, name, images, inventory, weight_oz, length_in, width_in, height_in)")
    .eq("id", offerId)
    .eq("user_id", user.id)
    .eq("status", "approved")
    .maybeSingle();

  if (!offerRaw) return { ok: false };

  const offer = offerRaw as any;
  const product = Array.isArray(offer.products) ? offer.products[0] : offer.products;
  if (!product || product.inventory < offer.quantity) {
    await sb.from("product_offers")
      .update({ status: "out_of_stock", updated_at: new Date().toISOString() })
      .eq("id", offerId);
    return { ok: false };
  }

  const cartRow = {
    user_id:    user.id,
    product_id: offer.product_id,
    slug:       product.slug,
    name:       product.name,
    price:      Number(offer.offer_price),
    quantity:   offer.quantity,
    image:      product.images?.[0] ?? null,
    weight_oz:  product.weight_oz,
    length_in:  product.length_in,
    width_in:   product.width_in,
    height_in:  product.height_in,
    offer_id:   offerId,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await sb
    .from("cart_items")
    .upsert(cartRow, { onConflict: "user_id,product_id" });

  if (upsertErr) return { ok: false };

  return {
    ok: true,
    item: {
      productId:  offer.product_id,
      name:       product.name,
      price:      Number(offer.offer_price),
      quantity:   offer.quantity,
      image:      product.images?.[0] ?? null,
      weight_oz:  product.weight_oz,
      length_in:  product.length_in,
      width_in:   product.width_in,
      height_in:  product.height_in,
      offerId,
    },
  };
}

// Called before adding an approved offer to cart. Returns ok=true if inventory
// is sufficient, or marks the offer as out_of_stock and returns ok=false.
export async function checkOfferInventory(offerId: string): Promise<{ ok: boolean }> {
  const sb = createServiceClient();

  const { data: offerRaw } = await sb
    .from("product_offers")
    .select("id, quantity, status, products(inventory)")
    .eq("id", offerId)
    .eq("status", "approved")
    .maybeSingle();

  if (!offerRaw) return { ok: false };

  const offer = offerRaw as { id: string; quantity: number; status: string; products: any };
  const productsData = Array.isArray(offer.products) ? offer.products[0] : offer.products;
  const inventory = (productsData as { inventory: number } | null)?.inventory ?? 0;

  if (inventory < offer.quantity) {
    await sb.from("product_offers")
      .update({ status: "out_of_stock", updated_at: new Date().toISOString() })
      .eq("id", offerId);
    revalidatePath("/account");
    refresh();
    return { ok: false };
  }

  return { ok: true };
}
