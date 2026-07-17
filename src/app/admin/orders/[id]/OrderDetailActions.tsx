"use client";

import { useState, useTransition } from "react";
import { Spinner } from "@/components/ui/spinner";
import { cancelOrder, clearLabelFromOrder, generateLabels, updateOrderStatus, voidLabel } from "@/lib/actions/orders";
import type { Order } from "@/types";

function CancelModal({
  orderNumber,
  totalPrice,
  surchargeAmount,
  surchargePercentage,
  restockingFeePercent,
  processingFeeFlat,
  onConfirm,
  onClose,
  isPending,
}: {
  orderNumber: string;
  totalPrice: number;
  surchargeAmount: number;
  surchargePercentage: number;
  restockingFeePercent: number;
  processingFeeFlat: number;
  onConfirm: (restoreInventory: boolean) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [restoreInventory, setRestoreInventory] = useState(true);
  const totalCents = Math.round(totalPrice * 100);
  const restockCents = restockingFeePercent > 0 ? Math.round(totalCents * restockingFeePercent / 100) : 0;
  const flatCents = Math.round(processingFeeFlat * 100);
  const totalDeductionCents = restockCents + flatCents;
  const refundCents = totalCents - totalDeductionCents;
  const surchargeCents = Math.round(surchargeAmount * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm rounded-lg bg-white shadow-xl p-6 space-y-4 mx-4">
        <h2 className="text-base font-semibold text-gray-900">Cancel Order #{orderNumber}?</h2>
        {(totalDeductionCents > 0 || surchargeCents > 0) ? (
          <div className="text-sm text-gray-600 space-y-1">
            {surchargeCents > 0 && (
              <div className="flex justify-between text-gray-400">
                <span>Surcharge ({surchargePercentage}%) included in total</span>
                <span>${(surchargeCents / 100).toFixed(2)}</span>
              </div>
            )}
            {restockCents > 0 && (
              <div className="flex justify-between">
                <span>Restocking fee ({restockingFeePercent}%)</span>
                <span>−${(restockCents / 100).toFixed(2)}</span>
              </div>
            )}
            {flatCents > 0 && (
              <div className="flex justify-between">
                <span>Flat fee</span>
                <span>−${(flatCents / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-800 border-t border-gray-200 pt-1 mt-1">
              <span>Customer refund</span>
              <span>${(refundCents / 100).toFixed(2)}</span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-600">This will issue a full Stripe refund to the customer.</p>
        )}

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={restoreInventory}
            onChange={(e) => setRestoreInventory(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">Restore inventory to website</span>
        </label>
        <p className="text-xs text-gray-400 -mt-2 pl-7">
          Uncheck only if the item was already shipped and you do not expect it back.
        </p>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onConfirm(restoreInventory)}
            disabled={isPending}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? <Spinner className="h-4 w-4 mx-auto" /> : "Confirm Cancel & Refund"}
          </button>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrderDetailActions({ order, restockingFeePercent = 0, processingFeeFlat = 0 }: { order: Order & { surcharge_amount?: number; surcharge_percentage?: number }; restockingFeePercent?: number; processingFeeFlat?: number }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [voidEasypostFailed, setVoidEasypostFailed] = useState(false);
  const [labelResult, setLabelResult] = useState<{ trackingNumber: string; labelUrl: string } | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  function handleCancelConfirm(restoreInventory: boolean) {
    startTransition(async () => {
      try {
        setError(null);
        await cancelOrder(order.id, restoreInventory);
        setShowCancelModal(false);
      } catch (err: any) {
        setError(err.message);
        setShowCancelModal(false);
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

  function handleVoidLabel() {
    if (!confirm("Void this label and request a refund from EasyPost? The order will return to paid status.")) return;
    startTransition(async () => {
      try {
        setError(null);
        setVoidEasypostFailed(false);
        const result = await voidLabel(order.id);
        if (!result.success) {
          setError(result.error ?? "Failed to void label");
          if (result.easypostError) setVoidEasypostFailed(true);
        }
      } catch (err: any) {
        setError(err.message);
      }
    });
  }

  function handleClearLabel() {
    if (!confirm("Remove this label from the order without a refund? The order will return to paid status. Only do this if EasyPost already denied the refund.")) return;
    startTransition(async () => {
      try {
        setError(null);
        setVoidEasypostFailed(false);
        const result = await clearLabelFromOrder(order.id);
        if (!result.success) setError(result.error ?? "Failed to clear label");
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
  const canVoidLabel = order.status === "shipped" && !!(order as any).easypost_shipment_id;

  if (order.status === "cancelled" || order.status === "fulfilled") return null;

  return (
    <>
      {showCancelModal && (
        <CancelModal
          orderNumber={order.id.slice(0, 8).toUpperCase()}
          totalPrice={Number(order.total_price)}
          surchargeAmount={Number(order.surcharge_amount ?? 0)}
          surchargePercentage={Number(order.surcharge_percentage ?? 0)}
          restockingFeePercent={restockingFeePercent}
          processingFeeFlat={processingFeeFlat}
          onConfirm={handleCancelConfirm}
          onClose={() => setShowCancelModal(false)}
          isPending={isPending}
        />
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
        {error && (
          <div className="space-y-2">
            <p className="text-sm text-red-500 bg-red-50 rounded-md px-3 py-2">{error}</p>
            {voidEasypostFailed && (
              <p className="text-xs text-gray-500 px-1">
                EasyPost denied the refund (carrier already has the package). You can remove the label from this order without a refund if needed.
              </p>
            )}
          </div>
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

          {canVoidLabel && !isPending && (
            <button
              onClick={handleVoidLabel}
              className="rounded-md border border-orange-200 px-4 py-2 text-sm font-medium text-orange-600 hover:bg-orange-50 transition-colors"
            >
              Void Label & Get Refund
            </button>
          )}
          {voidEasypostFailed && !isPending && (
            <button
              onClick={handleClearLabel}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Remove Label (No Refund)
            </button>
          )}

          {canCancel && !isPending && (
            <button
              onClick={() => setShowCancelModal(true)}
              className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              Cancel & Refund
            </button>
          )}
        </div>
      </div>
    </>
  );
}
