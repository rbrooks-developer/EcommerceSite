import Link from "next/link";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data/settings";
import { COUNTRIES } from "@/lib/data/countries";
import { redirect } from "next/navigation";
import { formatPrice, formatDate } from "@/lib/utils";
import { OrderStatusBadge } from "@/components/ui/badge";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { AddressManager } from "./AddressManager";
import { ProfileForm } from "./ProfileForm";
import { PasswordForm } from "./PasswordForm";
import { MyOffers } from "./MyOffers";
import type { Order, UserAddress } from "@/types";

type OrderRow = Pick<Order, "id" | "status" | "total_price" | "created_at" | "tracking_number">;

const panelStyle: React.CSSProperties = {
  border: "1px solid color-mix(in srgb, var(--site-fg) 20%, transparent)",
  backgroundColor: "var(--checkout-section-bg, color-mix(in srgb, var(--site-fg) 5%, var(--site-bg)))",
};

const dividerStyle: React.CSSProperties = {
  borderColor: "color-mix(in srgb, var(--site-fg) 12%, transparent)",
};

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="text-sm opacity-70 mt-0.5">{description}</p>}
    </div>
  );
}

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const settings = await getSettings();
  const allowedCodes = ((settings as any)?.shipping_countries as string[] | null) ?? ["US"];
  const allowedCountries = COUNTRIES.filter((c) => allowedCodes.includes(c.code));

  // Mark expired approved offers
  await supabase
    .from("product_offers")
    .update({ status: "expired" })
    .eq("user_id", user.id)
    .eq("status", "approved")
    .lt("expires_at", new Date().toISOString());

  // Check remaining approved offers: mark out_of_stock if product gone or inventory insufficient.
  const { data: approvedOffers, error: approvedErr } = await supabase
    .from("product_offers")
    .select("id, product_id, quantity")
    .eq("user_id", user.id)
    .eq("status", "approved");

  console.log("[account] approvedOffers:", JSON.stringify(approvedOffers), "error:", approvedErr?.message);

  if (approvedOffers && approvedOffers.length > 0) {
    const productIds = [...new Set(approvedOffers.map((o: any) => o.product_id as string))];
    const { data: products, error: productsErr } = await supabase
      .from("products")
      .select("id, inventory, is_published")
      .in("id", productIds);

    console.log("[account] products for offers:", JSON.stringify(products), "error:", productsErr?.message);

    const productMap = Object.fromEntries(
      ((products ?? []) as { id: string; inventory: number; is_published: boolean }[]).map(p => [p.id, p])
    );

    const outOfStockIds = (approvedOffers as { id: string; product_id: string; quantity: number }[])
      .filter(o => {
        const p = productMap[o.product_id];
        console.log(`[account] offer ${o.id}: qty=${o.quantity}, product inventory=${p?.inventory}, is_published=${p?.is_published}`);
        return !p || !p.is_published || p.inventory < o.quantity;
      })
      .map(o => o.id);

    console.log("[account] outOfStockIds:", outOfStockIds);

    if (outOfStockIds.length > 0) {
      const sb = createServiceClient();
      const { error: updateErr } = await sb
        .from("product_offers")
        .update({ status: "out_of_stock", updated_at: new Date().toISOString() })
        .in("id", outOfStockIds);
      console.log("[account] out_of_stock update error:", updateErr?.message ?? "none");
    }
  }

  const [{ data: profileRaw, error: profileError }, { data: addressesRaw }, { data: ordersRaw }, { data: offersRaw }] = await Promise.all([
    supabase.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("user_addresses").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id, status, total_price, created_at, tracking_number")
      .eq("user_id", user.id)
      .neq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("product_offers")
      .select("id, product_id, quantity, offer_price, status, decline_reason, expires_at, created_at, products(name, slug, images, weight_oz, length_in, width_in, height_in)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (profileError) console.error("[account] profile SELECT error:", profileError.message);

  const meta = user.user_metadata as Record<string, string | null> | null;
  const profile = {
    first_name: (profileRaw as any)?.first_name ?? meta?.first_name ?? null,
    last_name:  (profileRaw as any)?.last_name  ?? meta?.last_name  ?? null,
    phone:      (profileRaw as any)?.phone       ?? meta?.phone      ?? null,
  };
  const addresses = (addressesRaw ?? []) as UserAddress[];
  const orders    = (ordersRaw    ?? []) as OrderRow[];
  const offers    = (offersRaw    ?? []) as any[];

  return (
    <div className="space-y-10 pb-16">
      {/* Page header */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">My Account</h1>
        <form action={logout}>
          <Button type="submit" size="sm" className="font-semibold" style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)", fontFamily: "inherit" }}>Sign Out</Button>
        </form>
      </div>

      {/* ── Profile ─────────────────────────────────── */}
      <section>
        <SectionHeading title="Profile" description="Your name and contact details." />
        <div className="rounded-lg p-5" style={panelStyle}>
          <ProfileForm
            firstName={profile?.first_name ?? null}
            lastName={profile?.last_name ?? null}
            phone={profile?.phone ?? null}
            email={user.email ?? ""}
          />
        </div>
      </section>

      {/* ── Addresses ───────────────────────────────── */}
      <section>
        <SectionHeading title="Saved Addresses" description="Manage your shipping and billing addresses." />
        <div className="rounded-lg p-5" style={panelStyle}>
          <AddressManager addresses={addresses} allowedCountries={allowedCountries} />
        </div>
      </section>

      {/* ── My Offers ───────────────────────────────── */}
      <section id="offers" className="scroll-mt-24">
        <SectionHeading title="My Offers" description="Offers you've submitted on products." />
        <div className="rounded-lg p-5" style={panelStyle}>
          <MyOffers offers={offers} />
        </div>
      </section>

      {/* ── Order History ───────────────────────────── */}
      <section id="orders" className="scroll-mt-24">
        <SectionHeading title="Order History" />

        {orders.length === 0 ? (
          <div className="rounded-lg p-12 text-center" style={panelStyle}>
            <p className="text-sm mb-4" style={{ opacity: 0.4 }}>No orders yet.</p>
            <Link
              href="/products"
              className="inline-block rounded-md px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-80"
              style={{ backgroundColor: "var(--site-fg)", color: "var(--site-bg)" }}
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="space-y-3 md:hidden">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  href={`/account/orders/${order.id}`}
                  className="block rounded-lg p-4 transition-opacity hover:opacity-80"
                  style={panelStyle}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm font-medium">#{order.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs mt-0.5" style={{ opacity: 0.45 }}>{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <OrderStatusBadge status={order.status} />
                      <p className="text-sm font-semibold mt-1">{formatPrice(Number(order.total_price) * 100)}</p>
                    </div>
                  </div>
                  {order.tracking_number && (
                    <p className="text-xs mt-2" style={{ opacity: 0.45 }}>
                      Tracking: <span className="font-mono">{order.tracking_number}</span>
                    </p>
                  )}
                </Link>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden md:block rounded-lg overflow-hidden" style={panelStyle}>
              <table className="min-w-full text-sm" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "color-mix(in srgb, var(--site-fg) 10%, var(--checkout-section-bg, var(--site-bg)))", borderBottom: "1px solid color-mix(in srgb, var(--site-fg) 15%, transparent)" }}>
                    <th className="px-5 py-3 text-left font-medium" style={{ opacity: 0.6 }}>Order</th>
                    <th className="px-5 py-3 text-left font-medium" style={{ opacity: 0.6 }}>Date</th>
                    <th className="px-5 py-3 text-left font-medium" style={{ opacity: 0.6 }}>Status</th>
                    <th className="px-5 py-3 text-left font-medium" style={{ opacity: 0.6 }}>Total</th>
                    <th className="px-5 py-3 text-left font-medium" style={{ opacity: 0.6 }}>Tracking</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} style={{ borderBottom: "1px solid color-mix(in srgb, var(--site-fg) 10%, transparent)" }}>
                      <td className="px-5 py-3 font-mono text-xs font-medium">#{order.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-5 py-3 text-xs" style={{ opacity: 0.5 }}>{formatDate(order.created_at)}</td>
                      <td className="px-5 py-3"><OrderStatusBadge status={order.status} /></td>
                      <td className="px-5 py-3 font-medium">{formatPrice(Number(order.total_price) * 100)}</td>
                      <td className="px-5 py-3 font-mono text-xs" style={{ opacity: 0.5 }}>{order.tracking_number ?? "—"}</td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/account/orders/${order.id}`} className="text-xs underline underline-offset-2 transition-opacity hover:opacity-70" style={{ opacity: 0.6 }}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* ── Security ────────────────────────────────── */}
      <section>
        <SectionHeading title="Security" description="Update your password." />
        <div className="rounded-lg p-5" style={panelStyle}>
          <PasswordForm />
        </div>
      </section>
    </div>
  );
}
