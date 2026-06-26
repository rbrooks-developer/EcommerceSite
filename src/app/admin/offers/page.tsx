import { createServiceClient } from "@/lib/supabase/server";
import { OfferActions } from "./OfferActions";
import { formatPrice } from "@/lib/utils";

type ProfileData = { first_name: string | null; last_name: string | null; email: string };

type OfferRow = {
  id: string;
  user_id: string;
  quantity: number;
  offer_price: number;
  status: string;
  decline_reason: string | null;
  expires_at: string | null;
  created_at: string;
  products: { id: string; name: string; price: number; images: string[] } | null;
  profile: ProfileData | null;
};

export default async function AdminOffersPage() {
  const sb = createServiceClient();

  // Expire stale approved offers
  await sb
    .from("product_offers")
    .update({ status: "expired" })
    .eq("status", "approved")
    .lt("expires_at", new Date().toISOString());

  // product_offers.user_id → auth.users (not profiles), so we can't join profiles directly
  const { data: offersRaw, error } = await sb
    .from("product_offers")
    .select("id, user_id, quantity, offer_price, status, decline_reason, expires_at, created_at, products(id, name, price, images)")
    .order("created_at", { ascending: false });

  if (error) console.error("AdminOffersPage:", error.message);

  const rawOffers = (offersRaw ?? []) as Omit<OfferRow, "profile">[];

  // Fetch profiles separately
  const userIds = [...new Set(rawOffers.map(o => o.user_id))];
  const profileMap: Record<string, ProfileData> = {};
  if (userIds.length > 0) {
    const { data: profilesRaw } = await sb
      .from("profiles")
      .select("id, first_name, last_name, email")
      .in("id", userIds);
    for (const p of (profilesRaw ?? []) as (ProfileData & { id: string })[]) {
      profileMap[p.id] = p;
    }
  }

  const offers: OfferRow[] = rawOffers.map(o => ({ ...o, profile: profileMap[o.user_id] ?? null }));
  const pending = offers.filter(o => o.status === "pending");
  const history = offers.filter(o => o.status !== "pending");

  function OfferTable({ rows }: { rows: OfferRow[] }) {
    if (rows.length === 0) return <p className="text-sm text-gray-400 py-4">None.</p>;
    return (
      <div className="space-y-3">
        {rows.map(offer => {
          const listPrice = Number(offer.products?.price ?? 0);
          const pctOff = listPrice > 0 ? Math.round((1 - offer.offer_price / listPrice) * 100) : 0;
          const name = offer.profile?.first_name && offer.profile?.last_name
            ? `${offer.profile.first_name} ${offer.profile.last_name}`
            : offer.profile?.email ?? "Unknown";
          return (
            <div key={offer.id} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Product image */}
                {offer.products?.images?.[0] && (
                  <img src={offer.products.images[0]} alt="" className="h-14 w-14 rounded-md object-contain bg-gray-50 shrink-0" />
                )}

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900">{offer.products?.name ?? "—"}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{name} · {offer.profile?.email}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-600">
                    <span>Qty: <strong>{offer.quantity}</strong></span>
                    <span>Offer: <strong>{formatPrice(offer.offer_price * 100)}/ea</strong></span>
                    <span>List: <strong>{formatPrice(listPrice * 100)}</strong></span>
                    <span className="text-orange-600 font-semibold">{pctOff}% below list</span>
                    <span>Total offer: <strong>{formatPrice(offer.offer_price * offer.quantity * 100)}</strong></span>
                  </div>
                </div>

                {/* Status / actions */}
                <div className="shrink-0">
                  {offer.status === "pending" ? (
                    <OfferActions offerId={offer.id} />
                  ) : (
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-1 ${
                      offer.status === "approved"  ? "bg-green-100 text-green-700" :
                      offer.status === "purchased" ? "bg-indigo-100 text-indigo-700" :
                      offer.status === "declined"  ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {offer.status.charAt(0).toUpperCase() + offer.status.slice(1)}
                    </span>
                  )}
                </div>
              </div>

              {offer.status === "declined" && offer.decline_reason && (
                <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
                  Reason: {offer.decline_reason}
                </p>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Offers</h1>

      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Pending ({pending.length})</h2>
        <OfferTable rows={pending} />
      </section>

      <section>
        <h2 className="text-base font-semibold text-gray-700 mb-3">History</h2>
        <OfferTable rows={history} />
      </section>
    </div>
  );
}
