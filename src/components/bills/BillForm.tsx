"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { cn } from "@/lib/cn";
import { getDeviceIdentities } from "@/lib/device-identity";
import { formatMoney } from "@/lib/format";
import { computeEqualSplit } from "@/lib/settlement";

interface FormMember {
  id: string;
  name: string;
  avatarColor: string;
  isActive: boolean;
  createdAt: string;
}

interface InitialBill {
  id: string;
  title: string;
  totalAmount: number;
  payerId: string;
  splitMethod: string;
  status: string;
  splits: { memberId: string; shareAmount: number }[];
}

interface BillFormProps {
  mode: "create" | "edit";
  groupId: string;
  eventId: string;
  members: FormMember[];
  initialBill?: InitialBill;
}

function parseSen(text: string): number {
  const n = Number.parseFloat(text);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

// Screen Spec P5-01 (equal split) / P5-02 (custom amounts) / P5-03 (locked,
// rendered instead of the form below when the bill is settled). Split into
// a thin wrapper + inner component so the locked branch can return early
// without calling any hooks conditionally.
export function BillForm(props: BillFormProps) {
  const dashboardHref = `/g/${props.groupId}/events/${props.eventId}`;
  if (props.initialBill?.status === "settled") {
    return <LockedBillView dashboardHref={dashboardHref} bill={props.initialBill} />;
  }
  return <EditableBillForm {...props} />;
}

function EditableBillForm({ mode, groupId, eventId, members, initialBill }: BillFormProps) {
  const router = useRouter();
  const dashboardHref = `/g/${groupId}/events/${eventId}`;

  const activeMembers = members.filter((m) => m.isActive);
  const inactiveReferenced = members.filter((m) => !m.isActive);

  const [viewerMemberId, setViewerMemberId] = useState<string | null>(null);
  useEffect(() => {
    const identity = getDeviceIdentities().find((entry) => entry.groupId === groupId);
    setViewerMemberId(identity?.memberId ?? null);
  }, [groupId]);

  const [title, setTitle] = useState(initialBill?.title ?? "");
  const [amountText, setAmountText] = useState(
    initialBill ? (initialBill.totalAmount / 100).toFixed(2) : "",
  );
  const [payerId, setPayerId] = useState<string | null>(initialBill?.payerId ?? null);
  const [splitBetween, setSplitBetween] = useState<Set<string>>(
    () =>
      new Set(
        initialBill ? initialBill.splits.map((s) => s.memberId) : activeMembers.map((m) => m.id),
      ),
  );
  const [splitMethod, setSplitMethod] = useState<"equal" | "custom">(
    (initialBill?.splitMethod as "equal" | "custom") ?? "equal",
  );
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>(() => {
    if (initialBill?.splitMethod === "custom") {
      return Object.fromEntries(
        initialBill.splits.map((s) => [s.memberId, (s.shareAmount / 100).toFixed(2)]),
      );
    }
    return {};
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmountSen = parseSen(amountText);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  function toggleParticipant(id: string) {
    setSplitBetween((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function switchToCustom() {
    if (Object.keys(customAmounts).length === 0 && totalAmountSen > 0 && splitBetween.size > 0) {
      try {
        const shares = computeEqualSplit(
          totalAmountSen,
          [...splitBetween].map((id) => ({
            memberId: id,
            createdAt: new Date(memberById.get(id)!.createdAt),
          })),
          payerId ?? undefined,
        );
        setCustomAmounts(
          Object.fromEntries(shares.map((s) => [s.memberId, (s.shareAmount / 100).toFixed(2)])),
        );
      } catch {
        // totalAmount/participants not ready yet -- leave blank, filled in below
      }
    }
    setSplitMethod("custom");
  }

  const equalShares = useMemo(() => {
    if (splitMethod !== "equal" || totalAmountSen <= 0 || splitBetween.size === 0) return null;
    try {
      return computeEqualSplit(
        totalAmountSen,
        [...splitBetween].map((id) => ({
          memberId: id,
          createdAt: new Date(memberById.get(id)!.createdAt),
        })),
        payerId ?? undefined,
      );
    } catch {
      return null;
    }
  }, [splitMethod, totalAmountSen, splitBetween, payerId, memberById]);

  const customRunningTotal = [...splitBetween].reduce(
    (sum, id) => sum + parseSen(customAmounts[id] ?? ""),
    0,
  );
  const customReconciled = splitMethod === "custom" && customRunningTotal === totalAmountSen;

  const canSubmit =
    !submitting &&
    title.trim().length > 0 &&
    totalAmountSen > 0 &&
    payerId !== null &&
    splitBetween.size > 0 &&
    (splitMethod === "equal" ? equalShares !== null : customReconciled);

  async function handleSave() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const body =
      splitMethod === "equal"
        ? {
            title: title.trim(),
            totalAmount: totalAmountSen,
            payerId,
            splitMethod: "equal" as const,
            participantIds: [...splitBetween],
          }
        : {
            title: title.trim(),
            totalAmount: totalAmountSen,
            payerId,
            splitMethod: "custom" as const,
            customShares: [...splitBetween].map((id) => ({
              memberId: id,
              shareAmount: parseSen(customAmounts[id] ?? ""),
            })),
          };

    try {
      const res = await fetch(
        mode === "create" ? `/api/events/${eventId}/bills` : `/api/bills/${initialBill!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error("save failed");
      router.push(dashboardHref);
      router.refresh();
    } catch {
      setError("Couldn't save that bill — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-cream px-5 py-8 sm:px-9">
      <div className="mx-auto max-w-[580px]">
        <div className="mb-5.5 flex items-center justify-between">
          <h1 className="num text-2xl text-ink sm:text-[26px]">
            {mode === "create" ? "Add a bill" : "Edit bill"}
          </h1>
          <Link href={dashboardHref} className="text-xl text-muted-2" aria-label="Close">
            ×
          </Link>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">What&apos;s it for?</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nabe Dinner – Last Night"
            className="w-full rounded-md border border-ink/16 bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-forest"
          />
        </div>

        <div className="mb-4.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Total amount</label>
          <div className="num flex items-center gap-1.5 rounded-md border border-ink/16 bg-white px-4 py-3">
            <span className="text-[15px] text-muted-2">RM</span>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="0.00"
              className="w-full text-[18px] text-ink outline-none"
            />
          </div>
        </div>

        <div className="mb-4.5">
          <label className="mb-2 block text-xs font-bold text-muted-2">Paid by</label>
          <div className="flex flex-wrap gap-2">
            {activeMembers.map((m) => (
              <MemberSelectChip
                key={m.id}
                member={m}
                selected={payerId === m.id}
                isYou={m.id === viewerMemberId}
                onClick={() => setPayerId(m.id)}
              />
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-xs font-bold text-muted-2">Split between</label>
          <div className="flex flex-wrap gap-2">
            {activeMembers.map((m) => (
              <MemberSelectChip
                key={m.id}
                member={m}
                selected={splitBetween.has(m.id)}
                isYou={m.id === viewerMemberId}
                onClick={() => toggleParticipant(m.id)}
              />
            ))}
          </div>
          {inactiveReferenced.length > 0 && (
            <p className="mt-2 text-[11px] text-muted-2 italic">
              {inactiveReferenced.map((m) => m.name).join(", ")}{" "}
              {inactiveReferenced.length === 1 ? "is" : "are"} inactive — hidden from this list.
            </p>
          )}
        </div>

        <div className="mb-5 flex w-fit gap-1 rounded-md bg-app-bg p-1">
          <button
            type="button"
            onClick={() => setSplitMethod("equal")}
            className={cn(
              "rounded-[10px] px-4.5 py-2.5 text-[13.5px] font-bold",
              splitMethod === "equal" ? "bg-forest text-cream" : "text-muted",
            )}
          >
            Split equally
          </button>
          <button
            type="button"
            onClick={switchToCustom}
            className={cn(
              "rounded-[10px] px-4.5 py-2.5 text-[13.5px] font-bold",
              splitMethod === "custom" ? "bg-forest text-cream" : "text-muted",
            )}
          >
            Custom amounts
          </button>
        </div>

        {splitMethod === "equal" ? (
          <div className="mb-5 rounded-md border border-ink/8 bg-white px-4.5 py-4">
            {[...splitBetween].map((id) => {
              const member = memberById.get(id)!;
              const share = equalShares?.find((s) => s.memberId === id);
              return (
                <div key={id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={member.name} color={member.avatarColor} size={24} />
                    <span className="text-[13.5px] text-ink">
                      {member.name}
                      {id === viewerMemberId && (
                        <span className="ml-1.5 rounded-full bg-[#E4F9EE] px-[6px] py-px text-[9px] font-extrabold text-emerald">
                          you
                        </span>
                      )}
                    </span>
                  </div>
                  <span className="num text-[15px] text-ink">
                    {share ? formatMoney(share.shareAmount) : "—"}
                  </span>
                </div>
              );
            })}
            <div className="my-2 h-px bg-ink/7" />
            <div
              className={cn(
                "flex items-center gap-2 text-[13px] font-bold",
                equalShares ? "text-emerald" : "text-muted-2",
              )}
            >
              {equalShares ? `✓ Adds up to ${formatMoney(totalAmountSen)}` : "Enter an amount above"}
            </div>
          </div>
        ) : (
          <div className="mb-5">
            <div className="mb-3.5 rounded-md border border-ink/8 bg-white px-4.5 py-4">
              {[...splitBetween].map((id) => {
                const member = memberById.get(id)!;
                return (
                  <div key={id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar name={member.name} color={member.avatarColor} size={24} />
                      <span className="text-[13.5px] text-ink">{member.name}</span>
                    </div>
                    <div className="num flex items-center gap-1 rounded-md border border-ink/16 bg-white px-2.5 py-1.5">
                      <span className="text-[13px] text-muted-2">RM</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        inputMode="decimal"
                        value={customAmounts[id] ?? ""}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                        placeholder="0.00"
                        className="w-20 text-[14px] text-ink outline-none"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mb-3.5 flex items-center justify-between rounded-md border border-ink/8 bg-white px-4 py-3">
              <span className="text-[13px] font-bold text-muted-2">Running total</span>
              <span
                className={cn(
                  "num text-[16px]",
                  customReconciled ? "text-ink" : "text-coral",
                )}
              >
                {formatMoney(customRunningTotal)} / {formatMoney(totalAmountSen)}
              </span>
            </div>
            {!customReconciled && (
              <div className="flex items-center gap-2 rounded-md border border-[#EFC2B7] bg-[#FBEAE6] px-4 py-3 text-[13px] font-bold text-coral">
                ⚠ Amounts don&apos;t add up —{" "}
                {formatMoney(Math.abs(totalAmountSen - customRunningTotal))}
                {customRunningTotal < totalAmountSen ? " short of " : " over "}
                {formatMoney(totalAmountSen)}
              </div>
            )}
          </div>
        )}

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSave}
          className={cn(
            "w-full rounded-md py-4 text-center text-[15.5px] font-bold",
            canSubmit
              ? "bg-forest text-cream shadow-[0_8px_18px_-6px_rgba(22,58,46,0.5)] hover:bg-[#1a4536]"
              : "cursor-not-allowed bg-[#E4E2DC] text-[#A9A49C]",
          )}
        >
          Save bill
        </button>
      </div>
    </div>
  );
}

function MemberSelectChip({
  member,
  selected,
  isYou,
  onClick,
}: {
  member: FormMember;
  selected: boolean;
  isYou: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border-[1.5px] py-1.5 pr-3.5 pl-1.5",
        selected
          ? "border-forest bg-[#E4F9EE] text-forest"
          : "border-ink/14 bg-white text-muted",
      )}
    >
      <InitialsAvatar name={member.name} color={member.avatarColor} size={24} />
      <span className="text-[13px] font-bold">
        {member.name}
        {isYou && (
          <span
            className={cn(
              "ml-1.5 rounded-full px-[6px] py-px text-[9px] font-extrabold",
              selected ? "bg-forest text-cream" : "bg-cream text-muted-2",
            )}
          >
            you
          </span>
        )}
      </span>
    </button>
  );
}

function LockedBillView({
  dashboardHref,
  bill,
}: {
  dashboardHref: string;
  bill: InitialBill;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-5 py-8">
      <div className="w-full max-w-[520px] rounded-lg bg-white p-7 shadow-[0_16px_36px_-20px_rgba(19,46,40,0.22)] sm:p-8">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="text-xl">🔒</span>
          <h1 className="num text-[22px] text-ink">{bill.title}</h1>
        </div>
        <div className="mb-4.5 flex items-center gap-2.5 rounded-md bg-cream px-4.5 py-4">
          <span className="text-[15px]">🔒</span>
          <p className="text-[13px] leading-relaxed text-muted">
            This bill is <strong className="text-ink">settled and locked</strong>. Unmark it as
            settled from Settle up to make changes.
          </p>
        </div>
        <div className="pointer-events-none mb-4.5 opacity-45">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Total amount</label>
          <div className="rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-[14.5px] text-ink">
            {formatMoney(bill.totalAmount)}
          </div>
        </div>
        <div className="flex gap-2.5">
          <Link
            href={dashboardHref}
            className="flex-1 rounded-md bg-cream py-3.5 text-center text-sm font-bold text-ink"
          >
            Close
          </Link>
          <button
            type="button"
            disabled
            className="flex-1 cursor-not-allowed rounded-md bg-[#E4E2DC] py-3.5 text-center text-sm font-bold text-[#A9A49C]"
          >
            Save bill
          </button>
        </div>
      </div>
    </div>
  );
}
