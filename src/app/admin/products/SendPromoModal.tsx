"use client";

import { useState } from "react";
import { sendPromoToFans } from "@/lib/actions/email-templates";
import { Mail } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

type Template = { id: string; name: string };
type Promo = { id: string; code: string; discount_value: number; discount_type: string };

function Modal({
  productId,
  productName,
  templates,
  promos,
  onClose,
}: {
  productId: string;
  productName: string;
  templates: Template[];
  promos: Promo[];
  onClose: () => void;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [promoId, setPromoId] = useState(promos[0]?.id ?? "");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!templateId || !promoId) { setError("Select a template and promo code."); return; }
    setSending(true);
    setError(null);
    const res = await sendPromoToFans(productId, templateId, promoId);
    setSending(false);
    if (res.error) { setError(res.error); return; }
    setResult(`✅ Sent to ${res.sent} fan${res.sent === 1 ? "" : "s"}.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Send Promo to Fans</h2>
          <p className="text-sm text-gray-500 mt-0.5 truncate">{productName}</p>
        </div>

        {result ? (
          <div className="space-y-4">
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-md px-4 py-3">{result}</p>
            <button onClick={onClose} className="w-full rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        ) : (
          <>
            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-4 py-3">{error}</p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Template</label>
              {templates.length === 0 ? (
                <p className="text-sm text-gray-400">No templates yet. <a href="/admin/email-templates/new" className="text-blue-600 hover:underline">Create one first.</a></p>
              ) : (
                <select
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
              {promos.length === 0 ? (
                <p className="text-sm text-gray-400">No active promos. <a href="/admin/promos/new" className="text-blue-600 hover:underline">Create one first.</a></p>
              ) : (
                <select
                  value={promoId}
                  onChange={(e) => setPromoId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                >
                  {promos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.discount_type === "percent" ? `${p.discount_value}%` : `$${p.discount_value}`} off
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSend}
                disabled={sending || templates.length === 0 || promos.length === 0}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {sending ? <Spinner className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                {sending ? "Sending…" : "Send Emails"}
              </button>
              <button
                onClick={onClose}
                disabled={sending}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SendPromoButton({
  productId,
  productName,
  favoriteCount,
  templates,
  promos,
}: {
  productId: string;
  productName: string;
  favoriteCount: number;
  templates: Template[];
  promos: Promo[];
}) {
  const [open, setOpen] = useState(false);
  if (favoriteCount === 0) return null;

  return (
    <>
      {open && (
        <Modal
          productId={productId}
          productName={productName}
          templates={templates}
          promos={promos}
          onClose={() => setOpen(false)}
        />
      )}
      <button
        onClick={() => setOpen(true)}
        title="Send promo email to fans"
        className="inline-flex items-center gap-1 text-sm text-purple-600 hover:underline"
      >
        <Mail className="h-3.5 w-3.5" />
        Promo
      </button>
    </>
  );
}
