"use client";

import { useState } from "react";
import { togglePromoEnabled, deletePromo } from "@/lib/actions/promos";
import { useRouter } from "next/navigation";

export function PromoToggle({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    await togglePromoEnabled(id, !enabled);
    router.refresh();
    setBusy(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this promo code? This cannot be undone.")) return;
    setBusy(true);
    await deletePromo(id);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={toggle}
        disabled={busy}
        className="text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-40"
      >
        {enabled ? "Disable" : "Enable"}
      </button>
      <button
        onClick={handleDelete}
        disabled={busy}
        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 disabled:opacity-40"
      >
        Delete
      </button>
    </div>
  );
}
