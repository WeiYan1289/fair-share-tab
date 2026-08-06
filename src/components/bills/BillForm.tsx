"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { cn } from "@/lib/cn";
import { getCurrencyMeta } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { computeEqualSplit } from "@/lib/settlement";
import { Check, Lock, TriangleAlert } from "lucide-react";

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
  currency: string;
  members: FormMember[];
  initialBill?: InitialBill;
}

function parseAmount(text: string, minorUnit: number): number {
  const n = Number.parseFloat(text);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** minorUnit);
}

// Screen Spec P5-01 (equal split) / P5-02 (custom amounts) / P5-03 (locked,
// rendered instead of the form below when the bill is settled). Split into
// a thin wrapper + inner component so the locked branch can return early
// without calling any hooks conditionally.
export function BillForm(props: BillFormProps) {
  const dashboardHref = `/g/${props.groupId}/events/${props.eventId}`;
  if (props.initialBill?.status === "settled") {
    return (
      <LockedBillView
        dashboardHref={dashboardHref}
        bill={props.initialBill}
        members={props.members}
        currency={props.currency}
      />
    );
  }
  return <EditableBillForm {...props} />;
}

function EditableBillForm({ mode, groupId, eventId, currency, members, initialBill }: BillFormProps) {
  const router = useRouter();
  const dashboardHref = `/g/${groupId}/events/${eventId}`;
  const { symbol, minorUnit } = getCurrencyMeta(currency);

  const activeMembers = members.filter((m) => m.isActive);
  const inactiveReferenced = members.filter((m) => !m.isActive);

  const [title, setTitle] = useState(initialBill?.title ?? "");
  const [amountText, setAmountText] = useState(
    initialBill ? (initialBill.totalAmount / 10 ** minorUnit).toFixed(minorUnit) : "",
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
        initialBill.splits.map((s) => [
          s.memberId,
          (s.shareAmount / 10 ** minorUnit).toFixed(minorUnit),
        ]),
      );
    }
    return {};
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmountSen = parseAmount(amountText, minorUnit);
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
          Object.fromEntries(
            shares.map((s) => [s.memberId, (s.shareAmount / 10 ** minorUnit).toFixed(minorUnit)]),
          ),
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
    (sum, id) => sum + parseAmount(customAmounts[id] ?? "", minorUnit),
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
              shareAmount: parseAmount(customAmounts[id] ?? "", minorUnit),
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
    <div className="min-h-screen bg-cream px-5 py-8 sm:px-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[580px]">
        <div className="mb-5.5 flex items-center justify-between">
          <h1 className="num text-2xl text-ink sm:text-[26px] dark:text-dark-text">
            {mode === "create" ? "Add a bill" : "Edit bill"}
          </h1>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href={dashboardHref}
              className="text-xl text-muted-2 dark:text-dark-muted"
              aria-label="Close"
            >
              ×
            </Link>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">What&apos;s it for?</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nabe Dinner – Last Night"
            className="w-full rounded-md border border-ink/16 bg-white px-4 py-3 text-[15px] text-ink outline-none focus:border-forest dark:border-white/16 dark:bg-dark-card dark:text-dark-text"
          />
        </div>

        <div className="mb-4.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Total amount</label>
          <div className="num flex items-center gap-1.5 rounded-md border border-ink/16 bg-white px-4 py-3 dark:border-white/16 dark:bg-dark-card">
            <span className="text-[15px] text-muted-2">{symbol}</span>
            <input
              type="number"
              min="0"
              step={minorUnit === 0 ? "1" : "0.01"}
              inputMode={minorUnit === 0 ? "numeric" : "decimal"}
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder={minorUnit === 0 ? "0" : "0.00"}
              className="w-full text-[18px] text-ink outline-none dark:text-dark-text"
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

        <div className="mb-5 flex w-fit gap-1 rounded-md bg-app-bg p-1 dark:bg-dark-card">
          <button
            type="button"
            onClick={() => setSplitMethod("equal")}
            className={cn(
              "rounded-[10px] px-4.5 py-2.5 text-[13.5px] font-bold",
              splitMethod === "equal"
                ? "bg-forest text-cream dark:bg-dark-forest"
                : "text-muted dark:text-dark-muted",
            )}
          >
            Split equally
          </button>
          <button
            type="button"
            onClick={switchToCustom}
            className={cn(
              "rounded-[10px] px-4.5 py-2.5 text-[13.5px] font-bold",
              splitMethod === "custom"
                ? "bg-forest text-cream dark:bg-dark-forest"
                : "text-muted dark:text-dark-muted",
            )}
          >
            Custom amounts
          </button>
        </div>

        {splitMethod === "equal" ? (
          <div className="mb-5 rounded-md border border-ink/8 bg-white px-4.5 py-4 dark:border-white/8 dark:bg-dark-card">
            {[...splitBetween].map((id) => {
              const member = memberById.get(id)!;
              const share = equalShares?.find((s) => s.memberId === id);
              return (
                <div key={id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={member.name} color={member.avatarColor} size={24} />
                    <span className="text-[13.5px] text-ink dark:text-dark-text">
                      {member.name}
                    </span>
                  </div>
                  <span className="num text-[15px] text-ink dark:text-dark-text">
                    {share ? formatMoney(share.shareAmount, currency) : "—"}
                  </span>
                </div>
              );
            })}
            <div className="my-2 h-px bg-ink/7 dark:bg-white/10" />
            <div
              className={cn(
                "flex items-center gap-1.5 text-[13px] font-bold",
                equalShares ? "text-emerald dark:text-mint" : "text-muted-2",
              )}
            >
              {equalShares ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {`Adds up to ${formatMoney(totalAmountSen, currency)}`}
                </>
              ) : (
                "Enter an amount above"
              )}
            </div>
          </div>
        ) : (
          <div className="mb-5">
            <div className="mb-3.5 rounded-md border border-ink/8 bg-white px-4.5 py-4 dark:border-white/8 dark:bg-dark-card">
              {[...splitBetween].map((id) => {
                const member = memberById.get(id)!;
                return (
                  <div key={id} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar name={member.name} color={member.avatarColor} size={24} />
                      <span className="text-[13.5px] text-ink dark:text-dark-text">
                        {member.name}
                      </span>
                    </div>
                    <div className="num flex items-center gap-1 rounded-md border border-ink/16 bg-white px-2.5 py-1.5 dark:border-white/16 dark:bg-dark-bg">
                      <span className="text-[13px] text-muted-2">{symbol}</span>
                      <input
                        type="number"
                        min="0"
                        step={minorUnit === 0 ? "1" : "0.01"}
                        inputMode={minorUnit === 0 ? "numeric" : "decimal"}
                        value={customAmounts[id] ?? ""}
                        onChange={(e) =>
                          setCustomAmounts((prev) => ({ ...prev, [id]: e.target.value }))
                        }
                        placeholder={minorUnit === 0 ? "0" : "0.00"}
                        className="w-20 text-[14px] text-ink outline-none dark:text-dark-text"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mb-3.5 flex items-center justify-between rounded-md border border-ink/8 bg-white px-4 py-3 dark:border-white/8 dark:bg-dark-card">
              <span className="text-[13px] font-bold text-muted-2">Running total</span>
              <span
                className={cn(
                  "num text-[16px]",
                  customReconciled ? "text-ink dark:text-dark-text" : "text-coral",
                )}
              >
                {formatMoney(customRunningTotal, currency)} / {formatMoney(totalAmountSen, currency)}
              </span>
            </div>
            {!customReconciled && (
              <div className="flex items-center gap-2 rounded-md border border-coral-tint-border bg-coral-tint px-4 py-3 text-[13px] font-bold text-coral dark:border-coral/30 dark:bg-coral/10">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Amounts don&apos;t add up —{" "}
                  {formatMoney(Math.abs(totalAmountSen - customRunningTotal), currency)}
                  {customRunningTotal < totalAmountSen ? " short of " : " over "}
                  {formatMoney(totalAmountSen, currency)}
                </span>
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
              ? "bg-forest text-cream shadow-[0_8px_18px_-6px_rgba(22,58,46,0.5)] hover:bg-forest-hover dark:bg-dark-forest dark:hover:bg-dark-forest-hover"
              : "cursor-not-allowed bg-disabled text-disabled-text dark:bg-white/10 dark:text-white/30",
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
  onClick,
}: {
  member: FormMember;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border-[1.5px] py-1.5 pr-3.5 pl-1.5",
        selected
          ? "border-forest bg-mint-tint text-forest dark:border-mint dark:bg-mint/16 dark:text-mint"
          : "border-ink/14 bg-white text-muted dark:border-white/14 dark:bg-dark-card dark:text-dark-muted",
      )}
    >
      <InitialsAvatar name={member.name} color={member.avatarColor} size={24} />
      <span className="text-[13px] font-bold">{member.name}</span>
    </button>
  );
}

// Read-only detail for a settled bill (Screen Spec P5-03). Reachable by
// both editor and viewer sessions -- CLAUDE.md rule 10 makes settled bills
// immutable at the API layer regardless of role, so there is nothing here
// that needs an editor to be safe, and no reason a viewer shouldn't see
// what they were actually charged.
//
// Previously this rendered only the title and total, dimmed to 45%
// opacity, plus a disabled "Save bill" button -- a view so thin it read as
// a broken edit form rather than a bill you could inspect. It also told
// people to "unmark it as settled from Settle up," a flow that does not
// exist: rule 10 makes settled bills permanently immutable, full stop.
// That copy is corrected below rather than carried forward.
function LockedBillView({
  dashboardHref,
  bill,
  members,
  currency,
}: {
  dashboardHref: string;
  bill: InitialBill;
  members: FormMember[];
  currency: string;
}) {
  const memberById = new Map(members.map((m) => [m.id, m]));
  const payer = memberById.get(bill.payerId);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-5 py-8 dark:bg-dark-bg">
      <ThemeToggle className="absolute top-5 right-5 sm:top-7 sm:right-9" />
      <div className="w-full max-w-[520px] rounded-lg bg-white p-7 shadow-[0_16px_36px_-20px_rgba(19,46,40,0.22)] sm:p-8 dark:bg-dark-card">
        <div className="mb-4 flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-ink dark:text-dark-text" aria-hidden="true" />
          <h1 className="num text-[22px] text-ink dark:text-dark-text">{bill.title}</h1>
        </div>
        <div className="mb-5 flex items-center gap-2.5 rounded-md bg-cream px-4.5 py-4 dark:bg-dark-bg">
          <Lock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-muted dark:text-dark-muted">
            This bill is <strong className="text-ink dark:text-dark-text">settled</strong> and
            can&apos;t be changed.
          </p>
        </div>

        <div className="mb-4.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Total amount</label>
          <p className="num text-[22px] text-ink dark:text-dark-text">
            {formatMoney(bill.totalAmount, currency)}
          </p>
        </div>

        {payer && (
          <div className="mb-4.5">
            <label className="mb-1.5 block text-xs font-bold text-muted-2">Paid by</label>
            <div className="flex items-center gap-2.5">
              <InitialsAvatar name={payer.name} color={payer.avatarColor} size={26} />
              <span className="text-[14px] text-ink dark:text-dark-text">{payer.name}</span>
            </div>
          </div>
        )}

        <div className="mb-5">
          <label className="mb-2 block text-xs font-bold text-muted-2">
            Split {bill.splitMethod === "equal" ? "equally" : ""}
          </label>
          <div className="rounded-md border border-ink/8 bg-white px-4.5 py-4 dark:border-white/8 dark:bg-dark-card">
            {bill.splits.map((split) => {
              const member = memberById.get(split.memberId);
              return (
                <div key={split.memberId} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar
                      name={member?.name ?? "?"}
                      color={member?.avatarColor ?? "#8A9490"}
                      size={24}
                    />
                    <span className="text-[13.5px] text-ink dark:text-dark-text">
                      {member?.name ?? "Removed member"}
                    </span>
                  </div>
                  <span className="num text-[15px] text-ink dark:text-dark-text">
                    {formatMoney(split.shareAmount, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <Link
          href={dashboardHref}
          className="block rounded-md bg-cream py-3.5 text-center text-sm font-bold text-ink dark:bg-dark-bg dark:text-dark-text"
        >
          Close
        </Link>
      </div>
    </div>
  );
}
