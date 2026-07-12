import { createServiceClient } from "@/lib/supabase/server";
import { markAllCollectionsRead } from "@/lib/actions/collection";
import { CollectionRow } from "./CollectionActions";
import { formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Collection Requests" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("collection_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  const requests = data ?? [];
  const unreadCount = requests.filter((r) => !r.is_read).length;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Collection Requests</h1>
          {unreadCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {unreadCount} unread
              </span>
            </p>
          )}
        </div>

        {unreadCount > 0 && (
          <form action={markAllCollectionsRead}>
            <button
              type="submit"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline underline-offset-2 transition-colors"
            >
              Mark all as read
            </button>
          </form>
        )}
      </div>

      {/* Empty */}
      {requests.length === 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-20 text-center">
          <p className="text-gray-400 dark:text-gray-500 text-sm">No collection requests yet.</p>
        </div>
      )}

      {/* Table */}
      {requests.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800">
          {/* Table header */}
          <div className="grid grid-cols-[24px_1fr_1fr_auto_auto_auto] items-center gap-4 px-5 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div />
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Email</span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden sm:block">Phone</span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</span>
            <div />
          </div>

          {/* Rows */}
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {requests.map((req) => (
              <CollectionRow
                key={req.id}
                request={req}
                formattedDate={formatDate(req.created_at)}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
