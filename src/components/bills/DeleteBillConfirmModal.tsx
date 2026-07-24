"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";

interface DeleteBillConfirmModalProps {
  billId: string;
  billTitle: string;
  billAmount: number;
  currency: string;
  onClose: () => void;
  onDeleted: () => void;
}

// Screen Spec P5-04. Explicitly irreversible -- no undo/trash designed.
export function DeleteBillConfirmModal({
  billId,
  billTitle,
  billAmount,
  currency,
  onClose,
  onDeleted,
}: DeleteBillConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/bills/${billId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      onDeleted();
    } catch {
      setError("Couldn't delete that bill — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-lg bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] dark:bg-dark-card">
        <h2 className="num mb-2.5 text-[21px] text-ink dark:text-dark-text">
          Delete &quot;{billTitle}&quot;?
        </h2>
        <p className="mb-5.5 text-[13.5px] leading-relaxed text-muted dark:text-dark-muted">
          This removes the {formatMoney(billAmount, currency)} bill and recalculates everyone&apos;s
          balance. This can&apos;t be undone.
        </p>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleDelete}
            className="flex-1 rounded-md bg-coral py-3.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Delete bill
          </button>
        </div>
      </div>
    </div>
  );
}
