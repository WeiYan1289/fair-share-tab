"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExitGroupButton } from "@/components/group/ExitGroupButton";
import { MemberAccountControls } from "@/components/group/MemberAccountControls";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { TransferGraph } from "./TransferGraph";
import { TransferList } from "./TransferList";
import { Check } from "lucide-react";

// Above this many transfers the node-and-arrow graph needs scrolling to
// stay legible, so the list becomes the default view -- the user can still
// switch back with the toggle.
const GRAPH_TO_LIST_THRESHOLD = 12;

export interface SettleMember {
  id: string;
  name: string;
  avatarColor: string;
}

export interface SettleBill {
  id: string;
  title: string;
  payerName: string;
  splitCount: number;
  totalAmount: number;
}

export interface Transfer {
  fromMemberId: string;
  toMemberId: string;
  amount: number;
}

interface SettleUpFlowProps {
  groupId: string;
  eventId: string;
  eventName: string;
  currency: string;
  viewerRole: "editor" | "viewer";
  actorType: "member" | "visitor";
  members: SettleMember[];
  bills: SettleBill[];
}

// Screen Spec P6-01 (select) -> P6-02/P6-04 (graph, light/dark) -> P6-03
// (confirm, a modal over the graph rather than a separate route). This
// screen has its own minimal full-bleed header rather than GroupHeader --
// but a member's signed-in state should still be visible here, not just on
// pages that happen to render the shared header.
export function SettleUpFlow({
  groupId,
  eventId,
  eventName,
  currency,
  viewerRole,
  actorType,
  members,
  bills,
}: SettleUpFlowProps) {
  const router = useRouter();
  const dashboardHref = `/g/${groupId}/events/${eventId}`;
  const canConfirm = viewerRole === "editor";

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(bills.map((b) => b.id)));
  const [step, setStep] = useState<"select" | "graph">("select");
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [view, setView] = useState<"graph" | "list">("graph");
  const [calculating, setCalculating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBills = bills.filter((b) => selectedIds.has(b.id));
  const selectedTotal = selectedBills.reduce((sum, b) => sum + b.totalAmount, 0);

  function toggleBill(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCalculate() {
    if (selectedIds.size === 0) return;
    setCalculating(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/settlement/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: [...selectedIds] }),
      });
      if (!res.ok) throw new Error("preview failed");
      const data: { transfers: Transfer[] } = await res.json();
      setTransfers(data.transfers);
      setView(data.transfers.length > GRAPH_TO_LIST_THRESHOLD ? "list" : "graph");
      setStep("graph");
    } catch {
      setError("Couldn't calculate the settlement — check your connection and try again.");
    } finally {
      setCalculating(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${eventId}/settlement/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billIds: [...selectedIds] }),
      });
      if (!res.ok) throw new Error("confirm failed");
      router.push(dashboardHref);
      router.refresh();
    } catch {
      setError("Couldn't mark this as settled — check your connection and try again.");
      setConfirming(false);
    }
  }

  if (step === "select") {
    return (
      <div className="min-h-screen bg-cream px-5 py-8 sm:px-9 dark:bg-dark-bg">
        <div className="mx-auto max-w-[620px]">
          <div className="mb-4 flex items-center justify-between">
            <Link
              href={dashboardHref}
              className="block text-[13px] font-bold text-link dark:text-mint"
            >
              ← {eventName}
            </Link>
            <div className="flex items-center gap-3">
              {actorType === "member" ? <MemberAccountControls /> : <ExitGroupButton />}
              <TutorialButton />
              <ThemeToggle />
            </div>
          </div>
          <h1 className="num mb-1.5 text-[19px] leading-snug text-ink sm:text-[28px] dark:text-dark-text">
            Settle up — {eventName}
          </h1>
          <p className="mb-5 text-[13px] text-muted sm:mb-6 sm:text-sm dark:text-dark-muted">
            Select which unsettled bills to include.
          </p>

          {bills.length === 0 ? (
            <p className="rounded-md bg-white px-5 py-8 text-center text-[13.5px] text-muted dark:bg-dark-card dark:text-dark-muted">
              Nothing to settle — every bill in this event is already settled.
            </p>
          ) : (
            <>
              <div className="mb-6 flex flex-col gap-2.5">
                {bills.map((bill) => {
                  const checked = selectedIds.has(bill.id);
                  return (
                    <button
                      key={bill.id}
                      type="button"
                      onClick={() => toggleBill(bill.id)}
                      className="flex items-center gap-3.5 rounded-md border border-ink/8 bg-white px-4.5 py-3.5 text-left dark:border-white/8 dark:bg-dark-card"
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
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14.5px] font-bold text-ink dark:text-dark-text">
                          {bill.title}
                        </p>
                        {/* Own line each, rather than one truncating "Paid
                            by X · N-way split" string -- a long payer name
                            used to force the whole line to wrap mid-word. */}
                        <p className="mt-0.5 truncate text-[10.5px] leading-tight text-muted-2">
                          Paid by {bill.payerName}
                        </p>
                        <p className="text-[10.5px] leading-tight text-muted-2">
                          {bill.splitCount}-way split
                        </p>
                      </div>
                      <p className="num shrink-0 text-[17px] text-ink dark:text-dark-text">
                        {formatMoney(bill.totalAmount, currency)}
                      </p>
                    </button>
                  );
                })}
              </div>

              {error && <p className="mb-3 text-xs text-coral">{error}</p>}

              <div className="flex flex-col gap-3 rounded-md bg-mint-tint px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5.5 sm:py-4.5 dark:bg-mint/16">
                <p className="text-[13px] leading-snug font-bold text-emerald sm:text-sm dark:text-mint">
                  {selectedIds.size} bill{selectedIds.size === 1 ? "" : "s"} selected ·{" "}
                  {formatMoney(selectedTotal, currency)} total
                </p>
                <button
                  type="button"
                  disabled={selectedIds.size === 0 || calculating}
                  onClick={handleCalculate}
                  className="w-full shrink-0 rounded-md bg-forest px-6 py-3 text-sm font-bold whitespace-nowrap text-cream disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto dark:bg-dark-forest"
                >
                  Calculate →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-cream px-5 py-8 sm:px-9 dark:bg-dark-bg">
      <div className="mx-auto mb-4 flex max-w-[900px] items-center justify-between">
        <button
          type="button"
          onClick={() => setStep("select")}
          className="text-[13px] font-bold text-link dark:text-mint"
        >
          ← Back
        </button>
        <div className="flex items-center gap-3">
          {actorType === "member" ? <MemberAccountControls /> : <ExitGroupButton />}
          <TutorialButton />
          <ThemeToggle />
        </div>
      </div>
      <div className="mx-auto flex max-w-[900px] flex-col items-center">
        <h1 className="num mb-1.5 text-center text-[20px] leading-snug text-ink sm:text-[30px] dark:text-dark-text">
          Here&apos;s the simplest way to settle up
        </h1>
        <p className="mb-5 text-center text-[13px] text-muted sm:text-[14.5px] dark:text-dark-muted">
          {transfers.length} transfer{transfers.length === 1 ? "" : "s"} settle everyone — down
          from {selectedBills.length} bill{selectedBills.length === 1 ? "" : "s"}.
        </p>

        {/* The graph has no mobile shape of its own (Screen Spec: two
            different shapes at the two breakpoints, not one scaled
            version) -- mobile always gets the list, and the toggle below
            is a desktop-only concept. */}
        <div className="mb-6 hidden gap-1 rounded-md bg-app-bg p-1 sm:flex dark:bg-dark-bg" role="tablist">
          {(["graph", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-[10px] px-6 py-2 text-[13px] font-bold capitalize transition-colors",
                view === v
                  ? "bg-forest text-cream dark:bg-dark-forest"
                  : "text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text",
              )}
            >
              {v}
            </button>
          ))}
        </div>

        <div className="w-full sm:hidden">
          <TransferList transfers={transfers} members={members} currency={currency} />
        </div>
        <div className="hidden w-full sm:block">
          {view === "graph" ? (
            <TransferGraph transfers={transfers} members={members} currency={currency} />
          ) : (
            <TransferList transfers={transfers} members={members} currency={currency} />
          )}
        </div>

        <div className="mt-6 mb-4.5 flex items-center gap-2 rounded-md bg-mint-tint px-5 py-3.5 text-sm font-bold text-emerald dark:bg-mint/16 dark:text-mint">
          <Check className="h-4 w-4" aria-hidden="true" />
          {transfers.length} transfer{transfers.length === 1 ? "" : "s"} settle everyone
        </div>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        {canConfirm ? (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="rounded-md bg-forest px-10 py-4 text-[15.5px] font-bold text-cream shadow-[0_8px_18px_-6px_rgba(22,58,46,0.5)] dark:bg-dark-forest"
          >
            Mark as settled
          </button>
        ) : (
          <Link
            href={dashboardHref}
            className="rounded-md border border-ink/16 bg-white px-8 py-3.5 text-[14px] font-bold text-ink dark:border-white/16 dark:bg-dark-card dark:text-dark-text"
          >
            Back to dashboard
          </Link>
        )}
      </div>

      {showConfirm && (
        <ConfirmSettleModal
          transfers={transfers}
          members={members}
          currency={currency}
          billCount={selectedBills.length}
          confirming={confirming}
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}

function ConfirmSettleModal({
  transfers,
  members,
  currency,
  billCount,
  confirming,
  onCancel,
  onConfirm,
}: {
  transfers: Transfer[];
  members: SettleMember[];
  currency: string;
  billCount: number;
  confirming: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onCancel} />
      <div className="relative w-full max-w-[420px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-2.5 text-[21px] text-ink dark:text-dark-text">
          Mark these {transfers.length} transfer{transfers.length === 1 ? "" : "s"} as settled?
        </h2>
        <div className="mb-4 flex flex-col gap-2">
          {transfers.map((t, i) => (
            <div
              key={i}
              className="flex justify-between rounded-md bg-cream px-3 py-2 text-[13px] text-ink dark:bg-dark-bg dark:text-dark-text"
            >
              <span>
                {nameById.get(t.fromMemberId)} → {nameById.get(t.toMemberId)}
              </span>
              <span className="num text-[14px]">{formatMoney(t.amount, currency)}</span>
            </div>
          ))}
        </div>
        <p className="mb-5 text-[12.5px] leading-relaxed text-muted dark:text-dark-muted">
          This can&apos;t be undone — the {billCount} selected bill{billCount === 1 ? "" : "s"}{" "}
          will be marked settled and balances reset to zero.
        </p>
        <div className="flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-md bg-cream py-3.5 text-center text-sm font-bold text-ink dark:bg-dark-bg dark:text-dark-text"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={confirming}
            onClick={onConfirm}
            className="flex-1 rounded-md bg-forest py-3.5 text-center text-sm font-bold text-cream disabled:opacity-60 dark:bg-dark-forest"
          >
            Yes, mark as settled
          </button>
        </div>
      </div>
    </div>
  );
}
