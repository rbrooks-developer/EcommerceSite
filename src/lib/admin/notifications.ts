import { createServiceClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type NotificationSeverity = "info" | "warning" | "error";

export interface AdminNotificationMetadata {
  order_id?: string;
  order_number?: string;
  product_id?: string;
  product_name?: string;
  ebay_listing_id?: string;
  quantity?: number;
  action?: string;
  error?: string;
  [key: string]: unknown;
}

export async function createAdminNotification(payload: {
  type: string;
  severity?: NotificationSeverity;
  title: string;
  body: string;
  metadata?: AdminNotificationMetadata;
}): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase.from("admin_notifications").insert({
      type: payload.type,
      severity: payload.severity ?? "error",
      title: payload.title,
      body: payload.body,
      metadata: payload.metadata ?? {},
    });
  } catch (err: any) {
    console.error("[notifications] failed to create notification:", err.message);
  }
}

export async function markNotificationRead(id: string): Promise<void> {
  "use server";
  const supabase = createServiceClient();
  await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/admin/notifications");
}

export async function markAllNotificationsRead(): Promise<void> {
  "use server";
  const supabase = createServiceClient();
  await supabase
    .from("admin_notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  revalidatePath("/admin/notifications");
}

export async function deleteNotification(id: string): Promise<void> {
  "use server";
  const supabase = createServiceClient();
  await supabase.from("admin_notifications").delete().eq("id", id);
  revalidatePath("/admin/notifications");
}

export async function createTestNotification(): Promise<void> {
  "use server";
  await createAdminNotification({
    type: "ebay_inventory_sync_error",
    severity: "error",
    title: "eBay Inventory Sync Failed",
    body: "After order TEST1234 was paid, the eBay listing could not be updated automatically. Please adjust the listing quantity (or end it) manually.",
    metadata: {
      order_id:        "00000000-0000-0000-0000-000000000000",
      order_number:    "TEST1234",
      product_id:      "00000000-0000-0000-0000-000000000001",
      product_name:    "Amazing Spider-Man #1 (Test Item)",
      ebay_listing_id: "123456789012",
      quantity:        1,
      action:          "decrement",
      error:           "GetItem HTTP 500: Internal Server Error (simulated test)",
    },
  });
  revalidatePath("/admin/notifications");
}
