"use client";

import { useActionState, useState, useTransition } from "react";
import { createTariffCode, updateTariffCode, deleteTariffCode } from "@/lib/actions/tariff-codes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, X, Check, Plus } from "lucide-react";

type TariffCode = { id: string; hs_tariff_number: string; description: string };

function AddRow({ onCancel }: { onCancel: () => void }) {
  const [state, formAction, isPending] = useActionState(createTariffCode, null) as [
    { error?: string; success?: boolean } | null, (p: FormData) => void, boolean
  ];

  return (
    <form action={async (fd) => { formAction(fd); if (!state?.error) onCancel(); }} className="flex items-center gap-2 px-4 py-2 border-t border-gray-100 bg-gray-50">
      <Input name="hs_tariff_number" placeholder="e.g. 9705.00.0000" className="w-40 text-sm h-8" maxLength={20} required />
      <Input name="description" placeholder="Description" className="flex-1 text-sm h-8" maxLength={255} required />
      {state?.error && <p className="text-xs text-red-500 shrink-0">{state.error}</p>}
      <button type="submit" disabled={isPending} className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Save">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={onCancel} className="rounded p-1.5 text-gray-400 hover:bg-gray-100" title="Cancel">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

function EditRow({ code, onCancel }: { code: TariffCode; onCancel: () => void }) {
  const boundAction = updateTariffCode.bind(null, code.id);
  const [state, formAction, isPending] = useActionState(boundAction, null) as [
    { error?: string; success?: boolean } | null, (p: FormData) => void, boolean
  ];

  return (
    <form action={async (fd) => { formAction(fd); if (!state?.error) onCancel(); }} className="flex items-center gap-2 px-4 py-2 bg-blue-50">
      <Input name="hs_tariff_number" defaultValue={code.hs_tariff_number} className="w-40 text-sm h-8" maxLength={20} required />
      <Input name="description" defaultValue={code.description} className="flex-1 text-sm h-8" maxLength={255} required />
      {state?.error && <p className="text-xs text-red-500 shrink-0">{state.error}</p>}
      <button type="submit" disabled={isPending} className="rounded p-1.5 text-green-600 hover:bg-green-50" title="Save">
        <Check className="h-4 w-4" />
      </button>
      <button type="button" onClick={onCancel} className="rounded p-1.5 text-gray-400 hover:bg-gray-100" title="Cancel">
        <X className="h-4 w-4" />
      </button>
    </form>
  );
}

function DeleteButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Delete this tariff code?")) return;
        startTransition(() => deleteTariffCode(id));
      }}
      disabled={isPending}
      className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
      title="Delete"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

export function TariffCodesGrid({ codes }: { codes: TariffCode[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700">Tariff Code Library</h2>
        <button
          onClick={() => { setAdding(true); setEditingId(null); }}
          className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Code
        </button>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase tracking-wide">
        <span className="w-40">HS Tariff Number</span>
        <span className="flex-1">Description</span>
        <span className="w-16" />
      </div>

      {codes.length === 0 && !adding && (
        <p className="py-8 text-center text-sm text-gray-400">No tariff codes yet. Add one to get started.</p>
      )}

      {codes.map((code) =>
        editingId === code.id ? (
          <EditRow key={code.id} code={code} onCancel={() => setEditingId(null)} />
        ) : (
          <div key={code.id} className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 last:border-0 hover:bg-gray-50">
            <span className="w-40 font-mono text-sm text-gray-800">{code.hs_tariff_number}</span>
            <span className="flex-1 text-sm text-gray-700">{code.description}</span>
            <div className="flex items-center gap-1 w-16 justify-end">
              <button
                onClick={() => { setEditingId(code.id); setAdding(false); }}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
                title="Edit"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <DeleteButton id={code.id} />
            </div>
          </div>
        )
      )}

      {adding && <AddRow onCancel={() => setAdding(false)} />}
    </div>
  );
}
