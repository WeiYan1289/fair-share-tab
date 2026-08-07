"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";

interface ArchiveEventModalProps {
  event: {
    id: string;
    name: string;
    currency: string;
    unsettledCount: number;
    unsettledAmount: number;
  };
  onClose: () => void;
  onArchived: () => void;
}

// Warn-but-allow (spec 2026-08-06 feature B): archiving hides the event's
// amounts from every member's expenses and balances until restore, so when
// unsettled bills exist the modal says exactly what disappears. Restore
// needs no modal — it is non-destructive.
export function ArchiveEventModal({ event, onClose, onArchived }: ArchiveEventModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasUnsettled = event.unsettledCount > 0;

  async function handleArchive() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error("archive failed");
      onArchived();
    } catch {
      setError("Couldn't archive — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-2.5 text-xl text-ink sm:text-[22px] dark:text-dark-text">
          Archive {event.name}?
        </h2>
        <p className="mb-5 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
          {hasUnsettled ? (
            <>
              This event still has {event.unsettledCount} unsettled bill
              {event.unsettledCount === 1 ? "" : "s"} totalling{" "}
              <span className="num font-bold text-coral">
                {formatMoney(event.unsettledAmount, event.currency)}
              </span>
              . While archived, those amounts are hidden from everyone&apos;s
              balances and expense details, and the event can&apos;t be
              settled. Restore the event any time to bring them back.
            </>
          ) : (
            <>
              The event moves to the Archived section and its amounts are
              hidden from expense details. It can&apos;t be settled while
              archived. Restore it any time.
            </>
          )}
        </p>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={handleArchive}
            className="flex-1 text-center"
          >
            Archive event
          </Button>
        </div>
      </div>
    </div>
  );
}
