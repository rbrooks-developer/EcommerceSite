"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteEmailTemplate } from "@/lib/actions/email-templates";

export function DeleteEmailTemplateButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handle = async () => {
    if (!confirm("Delete this template? This cannot be undone.")) return;
    setLoading(true);
    const { error } = await deleteEmailTemplate(id);
    setLoading(false);
    if (error) { alert(error); return; }
    router.refresh();
  };

  return (
    <button
      onClick={handle}
      disabled={loading}
      className="text-red-600 hover:underline disabled:opacity-50 text-sm"
    >
      {loading ? "Deleting…" : "Delete"}
    </button>
  );
}
