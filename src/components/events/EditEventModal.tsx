"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { EventDateRangeField } from "@/components/ui/EventDateRangeField";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { describeApiError, NETWORK_ERROR_MESSAGE } from "@/components/ui/toast/error-message";

interface EditEventModalProps {
  eventId: string;
  currentName: string;
  currentStartDate: string | null;
  currentEndDate: string | null;
  currentCurrency: string;
  /** Drives whether the currency picker is live. The server independently
   * re-counts bills and 409s -- this only decides what the form offers. */
  hasBills: boolean;
  onClose: () => void;
  onSaved: () => void;
}

// Reached from the event card's overflow menu. Grew out of RenameEventModal:
// PATCH /api/events/{id} already accepted dates and re-validated start <= end
// against the stored values, so the rename-only form was the whole gap.
// No member-style length cap on the name: MAX_MEMBER_NAME_LENGTH exists
// because member names are rendered into narrow chips and settlement rows,
// which event names never are.
//
// Currency is offered only while the event has no bills. Amounts are stored
// as integers in the minor unit of the event's currency (CLAUDE.md rule 1),
// so switching currency on an event that holds bills reinterprets every
// stored amount instead of converting it -- 3000 is RM 30.00 under MYR and
// ¥3,000 under JPY. With no bills there is nothing to reinterpret.
export function EditEventModal({
  eventId,
  currentName,
  currentStartDate,
  currentEndDate,
  currentCurrency,
  hasBills,
  onClose,
  onSaved,
}: EditEventModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(currentName);
  const [currency, setCurrency] = useState(currentCurrency);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(
    currentStartDate && currentEndDate
      ? { start: currentStartDate, end: currentEndDate }
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  async function handleSave() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          // null clears a previously-set range; the field only ever yields
          // both dates or neither, so they always move together.
          startDate: dateRange?.start ?? null,
          endDate: dateRange?.end ?? null,
          ...(!hasBills && { currency }),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(describeApiError(res.status, body), "error");
        setError(
          typeof body?.error === "string"
            ? body.error
            : "Couldn't save — check your connection and try again.",
        );
        setSubmitting(false);
        return;
      }
      toast("Event updated");
      onSaved();
    } catch {
      toast(NETWORK_ERROR_MESSAGE, "error");
      setError("Couldn't save — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-4.5 text-xl text-ink sm:text-[22px] dark:text-dark-text">Edit event</h2>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Event name</label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
          />
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Currency</label>
          <CurrencySelect value={currency} onChange={setCurrency} isDisabled={hasBills} />
          {hasBills && (
            <p className="mt-1.5 text-[11px] text-muted-2">
              Fixed — this event already has bills, and their amounts are recorded in{" "}
              {currency}.
            </p>
          )}
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Dates</label>
          <EventDateRangeField value={dateRange} onChange={setDateRange} />
          <p className="mt-1.5 text-[11px] text-muted-2">
            Optional — pick both a start and end date, or leave both blank.
          </p>
        </div>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={handleSave} className="flex-1 text-center">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
