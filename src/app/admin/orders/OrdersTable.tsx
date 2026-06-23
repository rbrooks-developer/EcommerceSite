"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { formatPrice, formatDate } from "@/lib/utils";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { cancelOrder, generateLabels, updateOrderStatus } from "@/lib/actions/orders";
import { Spinner } from "@/components/ui/spinner";
import type { Order } from "@/types";

type OrderRow = Pick<
  Order,
  "id" | "status" | "total_price" | "shipping_name" | "created_at" | "tracking_number" | "shipping_label_url"
>;

interface Props {
  orders: OrderRow[];
}

export function OrdersTable({ orders }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [results, setResults] = useState<{ id: string; error?: string }[]>([]);

  const allIds = orders.filter((o) => o.status === "paid").map((o) => o.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected((s) => {
        const next = new Set(s);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((s) => new Set([...s, ...allIds]));
    }
  }

  function toggleOne(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleGenerateLabels() {
    const ids = [...selected];
    if (ids.length === 0) return;
    startTransition(async () => {
      const res = await generateLabels(ids);
      setResults(res.map((r) => ({ id: r.orderId, error: r.error })));
      setSelected(new Set());
    });
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-md bg-gray-900 px-4 py-3 text-white text-sm">
          <span>{selectedCount} order{selectedCount !== 1 ? "s" : ""} selected</span>
          <button
            onClick={handleGenerateLabels}
            disabled={isPending}
            className="ml-auto flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-100 disabled:opacity-60 transition-colors"
          >
            {isPending && <Spinner className="h-3 w-3 text-gray-900" />}
            Generate Labels
          </button>
          <button onClick={() => setSelected(new Set())} className="text-gray-400 hover:text-white text-xs">
            Clear
          </button>
        </div>
      )}

      {/* Label results feedback */}
      {results.length > 0 && (
        <div className="rounded-md border border-gray-200 bg-white divide-y text-sm">
          {results.map((r) => (
            <div key={r.id} className={`flex items-center gap-2 px-4 py-2 ${r.error ? "text-red-600" : "text-green-600"}`}>
              <span className="font-mono text-xs">{r.id.slice(0, 8).toUpperCase()}</span>
              <span>{r.error ? `Failed: ${r.error}` : "Label generated, email sent"}</span>
            </div>
          ))}
          <div className="px-4 py-2">
            <button onClick={() => setResults([])} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
          </div>
        </div>
      )}

      {/* Mobile card view */}
      <div className="space-y-3 md:hidden">
        {orders.length === 0 && (
          <p className="py-10 text-center text-sm text-gray-400">No orders yet.</p>
        )}
        {orders.map((order) => (
          <div key={order.id} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-medium text-gray-900">#{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-xs text-gray-500 mt-0.5">{order.shipping_name}</p>
                <p className="text-xs text-gray-400">{formatDate(order.created_at)}</p>
              </div>
              <div className="text-right">
                <OrderStatusBadge status={order.status} />
                <p className="text-sm font-semibold text-gray-900 mt-1">{formatPrice(Number(order.total_price) * 100)}</p>
              </div>
            </div>
            {order.tracking_number && (
              <p className="text-xs text-gray-500">Tracking: <span className="font-mono">{order.tracking_number}</span></p>
            )}
            <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
              <Link href={`/admin/orders/${order.id}`} className="text-sm text-blue-600 hover:underline">View</Link>
              <OrderRowActions order={order} />
              {order.status === "paid" && (
                <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.has(order.id)}
                    onChange={() => toggleOne(order.id)}
                    className="rounded"
                  />
                  Select
                </label>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    title="Select all paid orders"
                    className="rounded"
                  />
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Order</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Total</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Tracking</th>
                <th className="px-4 py-3 text-right font-medium text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-gray-400">No orders yet.</td>
                </tr>
              )}
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    {order.status === "paid" && (
                      <input
                        type="checkbox"
                        checked={selected.has(order.id)}
                        onChange={() => toggleOne(order.id)}
                        className="rounded"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-900">
                    #{order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{order.shipping_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(order.created_at)}</td>
                  <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatPrice(Number(order.total_price) * 100)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {order.tracking_number ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Link href={`/admin/orders/${order.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                      <OrderRowActions order={order} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function OrderRowActions({ order }: { order: OrderRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCancel() {
    if (!confirm(`Cancel order #${order.id.slice(0, 8).toUpperCase()}? This will issue a full Stripe refund.`)) return;
    startTransition(async () => {
      try {
        await cancelOrder(order.id);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleStatus(status: string) {
    startTransition(async () => {
      try {
        await updateOrderStatus(order.id, status as any);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleSingleLabel() {
    startTransition(async () => {
      try {
        await generateLabels([order.id]);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  if (isPending) return <Spinner className="h-4 w-4 text-gray-400" />;

  return (
    <div className="flex items-center gap-2 text-xs">
      {error && <span className="text-red-500 text-xs">{error}</span>}
      {order.status === "paid" && (
        <button onClick={handleSingleLabel} className="text-indigo-600 hover:underline">
          Label
        </button>
      )}
      {order.status === "shipped" && (
        <button onClick={() => handleStatus("fulfilled")} className="text-green-600 hover:underline">
          Mark Fulfilled
        </button>
      )}
      {(order.status === "paid" || order.status === "shipped") && (
        <button onClick={handleCancel} className="text-red-500 hover:underline">
          Cancel
        </button>
      )}
      {order.shipping_label_url && (
        <a href={order.shipping_label_url} target="_blank" rel="noreferrer" className="text-gray-500 hover:underline">
          Label PDF
        </a>
      )}
    </div>
  );
}
