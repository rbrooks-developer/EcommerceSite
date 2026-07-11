import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import type { SiteSettings } from "@/types";

export const getSettings = unstable_cache(
  async (): Promise<SiteSettings | null> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("site_settings")
      .select("*")
      .eq("id", 1)
      .single();
    return data;
  },
  ["site-settings"],
  {
    tags: ["site-settings"],
    revalidate: false,
  }
);
