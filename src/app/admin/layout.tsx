import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

const getAdminSidebarCounts = unstable_cache(
  async () => {
    const sb = createServiceClient();
    const [notifications, offers, collections] = await Promise.all([
      sb.from("admin_notifications").select("id", { count: "exact", head: true }).is("read_at", null),
      sb.from("product_offers").select("id", { count: "exact", head: true }).eq("status", "pending"),
      sb.from("collection_requests").select("id", { count: "exact", head: true }).eq("is_read", false),
    ]);
    return {
      unreadCount: notifications.count ?? 0,
      pendingOffersCount: offers.count ?? 0,
      pendingCollectionsCount: collections.count ?? 0,
    };
  },
  ["admin-sidebar-counts"],
  { revalidate: 30 }
);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, theme_preference")
    .eq("id", user.id)
    .maybeSingle();

  if ((profile as { role: string } | null)?.role !== "admin") redirect("/");

  const isDark = (profile as { theme_preference?: string | null } | null)?.theme_preference === "dark";

  const { unreadCount, pendingOffersCount, pendingCollectionsCount } = await getAdminSidebarCounts();

  return (
    <div data-admin-theme={isDark ? "dark" : "light"} className="flex h-screen flex-col lg:flex-row overflow-hidden bg-gray-50 text-gray-900" style={{ fontFamily: "var(--font-geist-sans), sans-serif", fontSize: "14px" }}>
      <AdminSidebar unreadNotifications={unreadCount ?? 0} pendingOffers={pendingOffersCount ?? 0} pendingCollections={pendingCollectionsCount ?? 0} isDark={isDark} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-4 md:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
