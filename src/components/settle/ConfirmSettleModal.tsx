"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";
import type { SettleMember, Transfer } from "./SettleUpFlow";

// The settle acknowledgement modal (Screen Spec P6-03). Shared by the
// single-event settle flow (SettleUpFlow) and the desktop workspace's
// per-event Settle up. Rule 10: a settlement is irreversible, so the confirm
// button stays disabled until the "these payments have been made in real
// life" checkbox is ticked. Type-only import of SettleMember/Transfer from
// SettleUpFlow is erased at build, so the SettleUpFlow <-> modal cycle is
// compile-time only.
export function ConfirmSettleModal({
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
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onCancel} />
      <div className="relative w-full max-w-[420px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-2.5 text-[21px] text-ink dark:text-dark-text">
          Mark these {transfers.length} transfer{transfers.length === 1 ? "" : "s"} as settled?
        </h2>
        <p className="mb-3 text-[12.5px] leading-relaxed text-muted dark:text-dark-muted">
          Check that each of these payments has actually been made:
        </p>
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
        <p className="mb-3 text-[12.5px] leading-relaxed text-muted dark:text-dark-muted">
          This can&apos;t be undone — the {billCount} selected bill{billCount === 1 ? "" : "s"}{" "}
          will be marked settled and balances reset to zero.
        </p>
        <label className="mb-5 flex cursor-pointer items-start gap-2.5 rounded-md bg-cream px-3.5 py-3 dark:bg-dark-bg">
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
            disabled={confirming || !acknowledged}
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
