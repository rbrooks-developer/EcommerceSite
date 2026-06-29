"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cancelOrder, generateLabels, updateOrderStatus } from "@/lib/actions/orders";
import type { Order } from "@/types";

export function OrderDetailActions({ order }: { order: Order }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [labelResult, setLabelResult] = useState<{ trackingNumber: string; labelUrl: string } | null>(null);

  function handleCancel() {
    if (!confirm(`Cancel order #${order.id.slice(0, 8).toUpperCase()}? This will issue a full Stripe refund.`)) return;
    startTransition(async () => {
      try {
        setError(null);
        await cancelOrder(order.id);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleStatus(status: string) {
    startTransition(async () => {
      try {
        setError(null);
        await updateOrderStatus(order.id, status as any);
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleGenerateLabel() {
    startTransition(async () => {
      try {
        setError(null);
        const results = await generateLabels([order.id]);
        const result = results[0];
        if (result?.success && result.trackingNumber) {
          setLabelResult({ trackingNumber: result.trackingNumber, labelUrl: result.labelUrl ?? "" });
        } else if (result?.error) {
          setError(result.error);
        }
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  const canCancel = order.status === "paid" || order.status === "shipped";
  const canGenerateLabel = order.status === "paid";
  const canMarkFulfilled = order.status === "shipped";

  if (order.status === "cancelled" || order.status === "fulfilled") return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
      {error && (
        <p className="text-sm text-red-500 bg-red-50 rounded-md px-3 py-2">{error}</p>
      )}
      {labelResult && (
        <div className="text-sm text-green-700 bg-green-50 rounded-md px-3 py-2 space-y-1">
          <p className="font-medium">Label generated!</p>
          <p>Tracking: <span className="font-mono">{labelResult.trackingNumber}</span></p>
          {labelResult.labelUrl && (
            <a href={labelResult.labelUrl} target="_blank" rel="noreferrer" className="underline text-green-800">
              Download Label PDF
            </a>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {isPending && <Spinner className="h-5 w-5 text-gray-400" />}

        {canGenerateLabel && !isPending && (
          <button
            onClick={handleGenerateLabel}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            Generate Shipping Label
          </button>
        )}

        {canCancel && !isPending && (
          <button
            onClick={handleCancel}
            className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Cancel & Refund
          </button>
        )}
      </div>
    </div>
  );
}
