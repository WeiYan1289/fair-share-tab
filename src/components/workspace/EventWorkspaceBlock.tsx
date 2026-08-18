"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BillRow, type EventBillView } from "@/components/bills/BillRow";
import { DeleteBillConfirmModal } from "@/components/bills/DeleteBillConfirmModal";
import { AddBillModal } from "@/components/workspace/AddBillModal";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { describeApiError, NETWORK_ERROR_MESSAGE } from "@/components/ui/toast/error-message";
import { ConfirmSettleModal } from "@/components/settle/ConfirmSettleModal";
import type { SettleMember } from "@/components/settle/SettleUpFlow";
import { previewTransfers } from "@/lib/settlement/preview-transfers";
import { cn } from "@/lib/cn";
import { formatDateRange, formatMoney } from "@/lib/format";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

export interface WorkspaceEventMember {
  id: string;
  name: string;
  avatarColor: string;
  isActive: boolean;
  createdAt: string;
  balance: number;
  share: number;
  paid: number;
  inAnyBill: boolean;
}

export interface WorkspaceEvent {
  id: string;
  groupId: string;
  name: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  totalSpend: number;
  members: WorkspaceEventMember[];
  bills: EventBillView[];
}

const GENERIC_SETTLE_ERROR = "Couldn't mark this as settled — check your connection and try again.";

// One event's self-contained workspace block on the desktop group workspace
// (spec tier 3). Collapsible; when open it is the three-column layout from the
// event dashboard (P4-01) plus inline add-bill and a live per-event settle
// preview. All money math and access rules are the event's own -- this only
// composes existing pieces.
export function EventWorkspaceBlock({
  groupId,
  event,
  canEdit,
  collapsed,
  onToggleCollapse,
}: {
  groupId: string;
  event: WorkspaceEvent;
  canEdit: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [formKey, setFormKey] = useState(0);
  const [adding, setAdding] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventBillView | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateRange = formatDateRange(event.startDate, event.endDate);
  const unsettledBillIds = event.bills.filter((b) => b.status === "unsettled").map((b) => b.id);
  const transfers = previewTransfers(event.members);
  const nameById = new Map(event.members.map((m) => [m.id, m.name]));
  const settleMembers: SettleMember[] = event.members.map((m) => ({
    id: m.id,
    name: m.name,
    avatarColor: m.avatarColor,
  }));
  const canSettle = canEdit && unsettledBillIds.length > 0;

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}/settlement/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: unsettledBillIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const message = typeof body?.error === "string" ? body.error : null;
        toast(describeApiError(res.status, body), "error");
        setError(message ?? GENERIC_SETTLE_ERROR);
        setConfirming(false);
        return;
      }
      toast("Settled up");
      setShowConfirm(false);
      setConfirming(false);
      router.refresh();
    } catch {
      toast(NETWORK_ERROR_MESSAGE, "error");
      setError(GENERIC_SETTLE_ERROR);
      setConfirming(false);
    }
  }

  const addBillChip = canEdit ? (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-forest bg-mint-tint px-3.5 py-1.5 text-[12.5px] font-bold text-forest hover:bg-mint-tint/70 dark:border-mint dark:bg-mint/16 dark:text-mint"
    >
      <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      Add a bill
    </button>
  ) : null;

  return (
    <section className="rounded-lg border border-ink/7 bg-white px-4 py-3.5 sm:px-5 sm:py-4 dark:border-white/7 dark:bg-dark-card">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <span className="shrink-0 text-muted-2" aria-hidden="true">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="num truncate text-[17px] text-ink sm:text-[19px] dark:text-dark-text">
              {event.name}
            </p>
            <p className="truncate text-[11.5px] text-muted-2 dark:text-dark-muted">
              {dateRange ? `${dateRange} · ` : ""}
              {event.currency}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          <div className="text-right">
            <p className="text-[10px] tracking-wide text-muted-2 uppercase">Total</p>
            <p className="num text-[16px] text-ink dark:text-dark-text">
              {formatMoney(event.totalSpend, event.currency)}
            </p>
          </div>
          {/* Settle up lives in the header so it's reachable without expanding. */}
          {canSettle && (
            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="rounded-md bg-forest px-3.5 py-2 text-[12.5px] font-bold text-cream hover:bg-forest-hover dark:bg-dark-forest"
            >
              Settle up
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div
          className={cn(
            "mt-4 grid grid-cols-1 gap-5 border-t border-ink/8 pt-4 dark:border-white/8",
            event.bills.length > 0 && "lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]",
          )}
        >
          {/* Center — bills. The add-a-bill entry point lives here now: a chip
              in the header when bills exist, centered in the empty state when
              they don't. */}
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold tracking-wide text-muted-2 uppercase">Bills</p>
              {event.bills.length > 0 && addBillChip}
            </div>
            {event.bills.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-md bg-cream px-4 py-8 text-center dark:bg-dark-bg">
                <p className="text-[13px] text-muted dark:text-dark-muted">
                  {canEdit
                    ? "No bills yet — add your first to start splitting."
                    : "No bills yet."}
                </p>
                {addBillChip}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {event.bills.map((bill) => (
                  <BillRow
                    key={bill.id}
                    bill={bill}
                    groupId={groupId}
                    eventId={event.id}
                    currency={event.currency}
                    canEdit={canEdit}
                    onRequestDelete={() => setDeleteTarget(bill)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right — live settle preview, then balances, then per-member spend.
              The Settle up button itself lives in the header. Hidden entirely
              when the event has no bills, so an empty block never shows empty
              Balances/Spent sections. */}
          {event.bills.length > 0 && (
            <div className="flex flex-col gap-5">
            <div>
              <p className="mb-3 text-[11px] font-bold tracking-wide text-muted-2 uppercase">
                Settle up · live
              </p>
              {unsettledBillIds.length === 0 ? (
                <p className="text-[12.5px] text-muted dark:text-dark-muted">
                  All bills settled.
                </p>
              ) : transfers.length === 0 ? (
                <p className="text-[12.5px] text-muted dark:text-dark-muted">
                  Everyone&rsquo;s square — nothing to transfer.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {transfers.map((t) => (
                    <div
                      key={`${t.fromMemberId}-${t.toMemberId}`}
                      className="flex items-center justify-between gap-2 text-[12.5px]"
                    >
                      <span className="min-w-0 truncate text-ink dark:text-dark-text">
                        {nameById.get(t.fromMemberId)}{" "}
                        <span className="text-muted-2">→</span> {nameById.get(t.toMemberId)}
                      </span>
                      <span className="num shrink-0 text-ink dark:text-dark-text">
                        {formatMoney(t.amount, event.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {error && <p className="mt-2 text-xs text-coral">{error}</p>}
            </div>

            <div className="border-t border-ink/8 pt-4 dark:border-white/8">
              <p className="mb-3 text-[11px] font-bold tracking-wide text-muted-2 uppercase">
                Balances
              </p>
              <div className="flex flex-col gap-2">
                {event.members
                  .filter((m) => m.inAnyBill)
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] text-ink dark:text-dark-text">
                        {m.name}
                      </span>
                      <span
                        className={cn(
                          "num shrink-0 text-[13.5px]",
                          m.balance > 0 && "text-emerald dark:text-mint",
                          m.balance < 0 && "text-coral",
                          m.balance === 0 && "text-muted-2",
                        )}
                      >
                        {m.balance > 0 ? "+" : m.balance < 0 ? "-" : ""}
                        {formatMoney(Math.abs(m.balance), event.currency)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="border-t border-ink/8 pt-4 dark:border-white/8">
              <p className="mb-3 text-[11px] font-bold tracking-wide text-muted-2 uppercase">
                Spent
              </p>
              <div className="flex flex-col gap-2">
                {event.members
                  .filter((m) => m.inAnyBill)
                  .map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-3">
                      <span className="truncate text-[13px] text-ink dark:text-dark-text">
                        {m.name}
                      </span>
                      <span className="num shrink-0 text-[13.5px] text-ink dark:text-dark-text">
                        {formatMoney(m.share, event.currency)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {adding && (
        <AddBillModal
          groupId={groupId}
          eventId={event.id}
          currency={event.currency}
          members={event.members}
          formKey={formKey}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setFormKey((k) => k + 1);
            router.refresh();
          }}
        />
      )}
      {deleteTarget && (
        <DeleteBillConfirmModal
          billId={deleteTarget.id}
          billTitle={deleteTarget.title}
          billAmount={deleteTarget.totalAmount}
          currency={event.currency}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setDeleteTarget(null);
            router.refresh();
          }}
        />
      )}
      {showConfirm && (
        <ConfirmSettleModal
          transfers={transfers}
          members={settleMembers}
          currency={event.currency}
          billCount={unsettledBillIds.length}
          confirming={confirming}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleConfirm}
        />
      )}
    </section>
  );
}
