"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { deleteAddress, setDefaultAddress } from "@/lib/actions/addresses";
import { AddressForm } from "./AddressForm";
import { Pencil, Trash2, Plus } from "lucide-react";
import { getCountryName } from "@/lib/data/countries";
import type { Country } from "@/lib/data/countries";
import type { UserAddress } from "@/types";

type AddressType = "shipping" | "billing";

function AddressSection({
  type,
  addresses,
  allowedCountries,
  isPending,
  onSetDefault,
  onDelete,
  onRefresh,
}: {
  type: AddressType;
  addresses: UserAddress[];
  allowedCountries: Country[];
  isPending: boolean;
  onSetDefault: (id: string, type: AddressType) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const editingAddress = editingId ? addresses.find((a) => a.id === editingId) ?? null : null;
  const defaultField = type === "shipping" ? "is_default_shipping" : "is_default_billing";
  const title = type === "shipping" ? "Shipping Addresses" : "Billing Addresses";

  const handleSuccess = useCallback(() => {
    setShowForm(false);
    setEditingId(null);
    onRefresh();
  }, [onRefresh]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>

      {addresses.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">No {type} addresses saved yet.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <div key={addr.id} className="relative rounded-lg border border-gray-200 bg-white p-4 flex flex-col gap-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                {addr[defaultField] && (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                    Default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => { setShowForm(false); setEditingId(addr.id); setConfirmDeleteId(null); }}
                  className="p-1.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                  aria-label="Edit address"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {!addr[defaultField] && (
                  confirmDeleteId === addr.id ? (
                    <span className="flex items-center gap-1">
                      <button onClick={() => { onDelete(addr.id); setConfirmDeleteId(null); }} disabled={isPending}
                        className="text-xs font-medium text-red-600 hover:text-red-700 px-1">
                        {isPending ? "…" : "Delete?"}
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-gray-400 hover:text-gray-600 px-1">
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(addr.id)}
                      className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="Delete address">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Address details */}
            <div className="text-sm text-gray-700 leading-relaxed">
              <p className="font-medium">{addr.first_name} {addr.last_name}</p>
              {addr.company && <p className="text-gray-500">{addr.company}</p>}
              <p>{addr.address_line1}</p>
              {addr.address_line2 && <p>{addr.address_line2}</p>}
              <p>{addr.city}{addr.state ? `, ${addr.state}` : ""} {addr.zip}</p>
              {addr.country !== "US" && <p className="text-gray-500">{getCountryName(addr.country)}</p>}
              {addr.phone && <p className="text-gray-500 mt-0.5">{addr.phone}</p>}
            </div>

            {/* Make Default link */}
            {!addr[defaultField] && (
              <button
                onClick={() => onSetDefault(addr.id, type)}
                disabled={isPending}
                className="self-start text-xs text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors disabled:opacity-50"
              >
                Make Default
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Edit form */}
      {editingId && editingAddress && (
        <AddressForm
          address={editingAddress}
          addressType={type}
          allowedCountries={allowedCountries}
          onClose={() => setEditingId(null)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Add form */}
      {showForm && !editingId && (
        <AddressForm
          addressType={type}
          allowedCountries={allowedCountries}
          onClose={() => setShowForm(false)}
          onSuccess={handleSuccess}
        />
      )}

      {/* Add link */}
      {!showForm && !editingId && (
        <button
          onClick={() => { setShowForm(true); setConfirmDeleteId(null); }}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add {type === "shipping" ? "Shipping" : "Billing"} Address
        </button>
      )}
    </div>
  );
}

export function AddressManager({ addresses, allowedCountries }: { addresses: UserAddress[]; allowedCountries: Country[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(() => router.refresh(), [router]);

  const handleSetDefault = (id: string, type: AddressType) => {
    startTransition(async () => {
      await setDefaultAddress(id, type);
      refresh();
    });
  };

  const handleDelete = (id: string) => {
    startTransition(async () => {
      await deleteAddress(id);
      refresh();
    });
  };

  const shippingAddresses = addresses.filter((a) => a.label === "shipping");
  const billingAddresses = addresses.filter((a) => a.label === "billing");

  return (
    <div className="space-y-8">
      <AddressSection
        type="shipping"
        addresses={shippingAddresses}
        allowedCountries={allowedCountries}
        isPending={isPending}
        onSetDefault={handleSetDefault}
        onDelete={handleDelete}
        onRefresh={refresh}
      />
      <AddressSection
        type="billing"
        addresses={billingAddresses}
        allowedCountries={allowedCountries}
        isPending={isPending}
        onSetDefault={handleSetDefault}
        onDelete={handleDelete}
        onRefresh={refresh}
      />
    </div>
  );
}
