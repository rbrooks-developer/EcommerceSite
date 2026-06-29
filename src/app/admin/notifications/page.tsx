import { createClient } from "@/lib/supabase/server";
import { markNotificationRead, markAllNotificationsRead, deleteNotification, createTestNotification } from "@/lib/admin/notifications";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

type Notification = {
  id: string;
  type: string;
  severity: "info" | "warning" | "error";
  title: string;
  body: string;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

const severityStyles = {
  error:   { bar: "bg-red-500",    badge: "bg-red-100 text-red-700",    icon: "✕" },
  warning: { bar: "bg-yellow-400", badge: "bg-yellow-100 text-yellow-700", icon: "!" },
  info:    { bar: "bg-blue-400",   badge: "bg-blue-100 text-blue-700",  icon: "i" },
};

const typeLabels: Record<string, string> = {
  ebay_inventory_sync_error: "eBay Inventory Sync",
  ebay_relist_error:         "eBay Relist",
};

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const notifications = (data ?? []) as Notification[];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <form action={createTestNotification}>
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
            >
              Send test notification
            </button>
          </form>
          {unreadCount > 0 && (
            <form action={markAllNotificationsRead}>
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700 underline underline-offset-2"
              >
                Mark all as read
              </button>
            </form>
          )}
        </div>
      </div>

      {notifications.length === 0 && (
        <div className="rounded-lg border border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-400 text-sm">No notifications yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {notifications.map((n) => {
          const style = severityStyles[n.severity] ?? severityStyles.error;
          const meta  = n.metadata as Record<string, unknown>;
          const isRead = !!n.read_at;

          return (
            <div
              key={n.id}
              className={`relative rounded-lg border bg-white overflow-hidden flex ${isRead ? "opacity-60" : ""}`}
            >
              {/* Severity bar */}
              <div className={`w-1 shrink-0 ${style.bar}`} />

              <div className="flex-1 p-4 space-y-3">
                {/* Header row */}
                <div className="flex items-start gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {!isRead && (
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                    )}
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.badge}`}>
                      {typeLabels[n.type] ?? n.type}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(n.created_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!isRead && (
                      <form action={markNotificationRead.bind(null, n.id)}>
                        <button
                          type="submit"
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Mark read
                        </button>
                      </form>
                    )}
                    <form action={deleteNotification.bind(null, n.id)}>
                      <button
                        type="submit"
                        title="Delete notification"
                        className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  </div>
                </div>

                {/* Title + body */}
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{n.title}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                </div>

                {/* Metadata detail grid */}
                {Object.keys(meta).length > 0 && (
                  <div className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    {!!meta.order_number && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-28 shrink-0">Order</span>
                        <Link
                          href={`/admin/orders/${String(meta.order_id)}`}
                          className="font-mono font-medium text-blue-600 hover:underline"
                        >
                          #{String(meta.order_number)}
                        </Link>
                      </div>
                    )}
                    {!!meta.product_name && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-28 shrink-0">Product</span>
                        <span className="font-medium text-gray-800 truncate">{String(meta.product_name)}</span>
                      </div>
                    )}
                    {!!meta.ebay_listing_id && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-28 shrink-0">eBay Listing ID</span>
                        <a
                          href={`https://www.ebay.com/itm/${String(meta.ebay_listing_id)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-blue-600 hover:underline"
                        >
                          {String(meta.ebay_listing_id)}
                        </a>
                      </div>
                    )}
                    {meta.quantity != null && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-28 shrink-0">Quantity</span>
                        <span className="font-medium text-gray-800">{`${meta.quantity}`}</span>
                      </div>
                    )}
                    {!!meta.action && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 w-28 shrink-0">Action attempted</span>
                        <span className="font-medium text-gray-800">{String(meta.action)}</span>
                      </div>
                    )}
                    {!!meta.error && (
                      <div className="flex items-start gap-2 sm:col-span-2">
                        <span className="text-gray-400 w-28 shrink-0 pt-px">Error</span>
                        <span className="font-mono text-red-600 break-all">{String(meta.error)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
