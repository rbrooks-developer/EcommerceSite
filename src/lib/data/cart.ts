import { createServiceClient } from "@/lib/supabase/server";

export async function getHotCartCounts(
  productIds: string[],
  excludeUserId?: string | null,
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {};

  const supabase = createServiceClient();
  let query = supabase
    .from("cart_items")
    .select("product_id, user_id")
    .in("product_id", productIds);

  if (excludeUserId) {
    query = query.neq("user_id", excludeUserId);
  }

  const { data } = await query;
  if (!data) return {};

  const userSets: Record<string, Set<string>> = {};
  for (const row of data as { product_id: string; user_id: string }[]) {
    if (!userSets[row.product_id]) userSets[row.product_id] = new Set();
    userSets[row.product_id].add(row.user_id);
  }

  const result: Record<string, number> = {};
  for (const [id, users] of Object.entries(userSets)) {
    result[id] = users.size;
  }
  return result;
}
