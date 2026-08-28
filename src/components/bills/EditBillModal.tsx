"use client";

import { useEffect, useState } from "react";
import { BillForm } from "@/components/bills/BillForm";
import type { BillModalMember } from "@/components/workspace/AddBillModal";

interface BillPayload {
  currency: string;
  viewOnly: boolean;
  members: BillModalMember[];
  bill: {
    id: string;
    title: string;
    totalAmount: number;
    payerId: string;
    splitMethod: string;
    status: string;
    receiptUrl: string | null;
    splits: { memberId: string; shareAmount: number }[];
  };
}

// Edit (or, for a settled bill / a viewer, inspect) a bill in a modal from the
// event dashboard and the one-page workspace — so leaving it never navigates
// away from the surface you opened it on. It fetches the bill's full detail
// (GET /api/bills/{id}) on open, since the list rows don't carry splits, then
// renders the embedded BillForm. The standalone /bills/{id}/edit page still
// exists and is unchanged for direct links.
export function EditBillModal({
  groupId,
  eventId,
  billId,
  canEdit,
  onClose,
  onSaved,
}: {
  groupId: string;
  eventId: string;
  billId: string;
  /** The surface's own edit gate (false for a viewer or an archived event).
   * Combined with the API's `viewOnly` (settled bills) to decide read-only. */
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<BillPayload | null>(null);
  const [error, setError] = useState(false);
  const viewOnly = !canEdit || (data?.viewOnly ?? false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/bills/${billId}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("load failed");
        return (await res.json()) as BillPayload;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [billId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-[580px] flex-col overflow-hidden rounded-lg bg-white shadow-[0_24px_48px_-16px_rgba(19,46,40,0.28)] dark:bg-dark-card">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="num text-xl text-ink dark:text-dark-text">
            {viewOnly ? "Bill details" : "Edit bill"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl text-muted-2 dark:text-dark-muted"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">
          {error ? (
            <p className="py-6 text-[13.5px] text-coral">
              Couldn&apos;t load this bill — close this and try again.
            </p>
          ) : !data ? (
            <p className="py-6 text-[13.5px] text-muted dark:text-dark-muted">Loading…</p>
          ) : (
            <BillForm
              embedded
              mode="edit"
              viewOnly={viewOnly}
              groupId={groupId}
              eventId={eventId}
              currency={data.currency}
              members={data.members}
              initialBill={data.bill}
              onSaved={onSaved}
            />
          )}
        </div>
      </div>
    </div>
  );
}
