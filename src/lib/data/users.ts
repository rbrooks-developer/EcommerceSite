import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";

export const getCachedUserSidebarData = (userId: string) =>
  unstable_cache(
    async () => {
      const sb = createServiceClient();
      const [profileResult, offersResult] = await Promise.all([
        sb.from("profiles").select("role, avatar_url").eq("id", userId).maybeSingle(),
        sb.from("product_offers").select("id", { count: "exact", head: true }).eq("user_id", userId).in("status", ["approved", "countered"]),
      ]);
      return {
        role: (profileResult.data as { role: string } | null)?.role ?? null,
        avatarUrl: (profileResult.data as { avatar_url?: string | null } | null)?.avatar_url ?? null,
        approvedOffersCount: offersResult.count ?? 0,
      };
    },
    ["user-sidebar", userId],
    { revalidate: 60 }
  )();
