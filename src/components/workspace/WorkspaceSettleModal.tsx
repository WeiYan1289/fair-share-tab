"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import type { SettleMember, Transfer } from "@/components/settle/SettleUpFlow";
import { Check } from "lucide-react";

export interface SettleModalEvent {
  id: string;
  name: string;
  billIds: string[];
  unsettledTotal: number;
}

const GENERIC_PREVIEW_ERROR = "Couldn't calculate the settlement — check your connection and try again.";
const GENERIC_CONFIRM_ERROR = "Couldn't mark this as settled — check your connection and try again.";

// In-place cross-event settle for the desktop workspace's member overview.
// Mirrors the per-event Settle up (a modal, not a page navigation): events in
// the currency are pre-selected, the user can uncheck any, then confirm with
// the real-life acknowledgement (rule 10). Posts to the same group
// preview/confirm endpoints as the classic cross-event flow, so all the money
// guards are server-side; the workspace just never leaves the page.
export function WorkspaceSettleModal({
  groupId,
  currency,
  events,
  members,
  canConfirm,
  onClose,
  onSettled,
}: {
  groupId: string;
  currency: string;
  events: SettleModalEvent[];
  members: SettleMember[];
  canConfirm: boolean;
  onClose: () => void;
  onSettled: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(events.map((e) => e.id)));
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameById = new Map(members.map((m) => [m.id, m.name]));
  const selectedEvents = events.filter((e) => selectedIds.has(e.id));
  const selectedBillIds = selectedEvents.flatMap((e) => e.billIds);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function calculate() {
    if (selectedBillIds.length === 0) return;
    setCalculating(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlement/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: selectedBillIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : GENERIC_PREVIEW_ERROR);
        return;
      }
      const data: { transfers: Transfer[] } = await res.json();
      setTransfers(data.transfers);
      setAcknowledged(false);
      setStep("confirm");
    } catch {
      setError(GENERIC_PREVIEW_ERROR);
    } finally {
      setCalculating(false);
    }
  }

  async function confirm() {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/settlement/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: selectedBillIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(typeof body?.error === "string" ? body.error : GENERIC_CONFIRM_ERROR);
        setConfirming(false);
        return;
      }
      onSettled();
    } catch {
      setError(GENERIC_CONFIRM_ERROR);
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-[460px] overflow-auto rounded-t-xl bg-white p-6 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-1 text-[20px] text-ink dark:text-dark-text">Settle up · {currency}</h2>

        {step === "select" ? (
          <>
            <p className="mb-4 text-[12.5px] leading-relaxed text-muted dark:text-dark-muted">
              Select which events to settle together — all are selected by default. Their unsettled
              bills are settled as one.
            </p>
            <div className="mb-4 flex flex-col gap-2">
              {events.map((e) => {
                const checked = selectedIds.has(e.id);
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggle(e.id)}
                    className="flex items-center gap-3 rounded-md border border-ink/8 px-3.5 py-2.5 text-left dark:border-white/8"
                  >
                    <span
                      className={
                        checked
                          ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-forest text-cream dark:bg-dark-forest"
                          : "h-5 w-5 shrink-0 rounded-md border-2 border-ink/16 dark:border-white/20"
                      }
                    >
                      {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink dark:text-dark-text">
                      {e.name}
                    </span>
                    <span className="num shrink-0 text-[13.5px] text-ink dark:text-dark-text">
                      {formatMoney(e.unsettledTotal, currency)}
                    </span>
                  </button>
                );
              })}
            </div>
            {error && <p className="mb-3 text-xs text-coral">{error}</p>}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-md bg-cream py-3 text-center text-sm font-bold text-ink dark:bg-dark-bg dark:text-dark-text"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedBillIds.length === 0 || calculating}
                onClick={calculate}
                className="flex-1 rounded-md bg-forest py-3 text-center text-sm font-bold text-cream disabled:opacity-60 dark:bg-dark-forest"
              >
                {calculating ? "Calculating…" : "Calculate →"}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mb-3 text-[12.5px] leading-relaxed text-muted dark:text-dark-muted">
              {transfers.length} transfer{transfers.length === 1 ? "" : "s"} settle everyone across{" "}
              {selectedEvents.length} event{selectedEvents.length === 1 ? "" : "s"}. This can&apos;t be
              undone.
            </p>
            <div className="mb-4 flex flex-col gap-2">
              {transfers.length === 0 ? (
                <p className="rounded-md bg-cream px-3 py-2 text-[12.5px] text-muted dark:bg-dark-bg dark:text-dark-muted">
                  Everyone&rsquo;s square — the selected bills will just be marked settled.
                </p>
              ) : (
                transfers.map((t, i) => (
                  <div
                    key={i}
                    className="flex justify-between rounded-md bg-cream px-3 py-2 text-[13px] text-ink dark:bg-dark-bg dark:text-dark-text"
                  >
                    <span>
                      {nameById.get(t.fromMemberId)} → {nameById.get(t.toMemberId)}
                    </span>
                    <span className="num text-[14px]">{formatMoney(t.amount, currency)}</span>
                  </div>
                ))
              )}
            </div>
            {canConfirm && (
              <label className="mb-4 flex cursor-pointer items-start gap-2.5 rounded-md bg-cream px-3.5 py-3 dark:bg-dark-bg">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
                />
                <span className="text-[13px] font-semibold text-ink dark:text-dark-text">
                  These payments have been made in real life
                </span>
              </label>
            )}
            {error && <p className="mb-3 text-xs text-coral">{error}</p>}
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setStep("select")}
                className="flex-1 rounded-md bg-cream py-3 text-center text-sm font-bold text-ink dark:bg-dark-bg dark:text-dark-text"
              >
                Back
              </button>
              {canConfirm ? (
                <button
                  type="button"
                  disabled={confirming || !acknowledged}
                  onClick={confirm}
                  className="flex-1 rounded-md bg-forest py-3 text-center text-sm font-bold text-cream disabled:opacity-60 dark:bg-dark-forest"
                >
                  Yes, mark as settled
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-md bg-cream py-3 text-center text-sm font-bold text-ink dark:bg-dark-bg dark:text-dark-text"
                >
                  Close
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
