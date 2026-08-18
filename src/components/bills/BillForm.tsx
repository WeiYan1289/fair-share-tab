"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ReceiptField } from "@/components/bills/ReceiptField";
import { ReceiptThumbnail } from "@/components/bills/ReceiptThumbnail";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { useReceiptUpload } from "@/lib/receipts/use-receipt-upload";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { describeApiError, NETWORK_ERROR_MESSAGE } from "@/components/ui/toast/error-message";
import { cn } from "@/lib/cn";
import { getCurrencyMeta } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import { computeEqualSplit } from "@/lib/settlement";
import { Check, Eye, TriangleAlert } from "lucide-react";

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
  receiptUrl?: string | null;
  splits: { memberId: string; shareAmount: number }[];
}

interface BillFormProps {
  mode: "create" | "edit";
  groupId: string;
  eventId: string;
  currency: string;
  members: FormMember[];
  initialBill?: InitialBill;
  /** When provided (create mode only), called after a successful create
   * instead of navigating to the dashboard -- the desktop workspace's
   * embedded add-bill panel refreshes in place and remounts the form. */
  onSaved?: () => void;
  /** Denser split UI for the desktop workspace's narrow add-bill column.
   * Absent on the standalone /bills/new route, which is unchanged. */
  compact?: boolean;
  /** True for two independent reasons: the bill is settled (immutable
   * regardless of role), or the caller isn't an editor. Read-only either
   * way, but the two cases get different banner copy below -- one is a
   * property of the bill, the other of who's looking at it. */
  viewOnly?: boolean;
  /** When true, render only the field stack -- no full-page wrapper and no
   * header row (ThemeToggle + heading + close). The caller (AddBillModal)
   * supplies the frame. Absent on the standalone /bills/new route, which is
   * unchanged. */
  embedded?: boolean;
}

function parseAmount(text: string, minorUnit: number): number {
  const n = Number.parseFloat(text);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10 ** minorUnit);
}

// Screen Spec P5-01 (equal split) / P5-02 (custom amounts) / P5-03
// (read-only, rendered instead of the form below whenever the caller can't
// write to this bill). Split into a thin wrapper + inner component so the
// read-only branch can return early without calling any hooks
// conditionally.
export function BillForm(props: BillFormProps) {
  const dashboardHref = `/g/${props.groupId}/events/${props.eventId}`;
  if (props.initialBill && props.viewOnly) {
    return (
      <ReadOnlyBillView
        dashboardHref={dashboardHref}
        bill={props.initialBill}
        members={props.members}
        currency={props.currency}
      />
    );
  }
  return <EditableBillForm {...props} />;
}

function EditableBillForm({ mode, groupId, eventId, currency, members, initialBill, onSaved, compact, embedded }: BillFormProps) {
  const router = useRouter();
  const { toast } = useToast();
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

  const receipt = useReceiptUpload(groupId, initialBill?.receiptUrl);
  // Set when a save succeeded but the receipt did not make it. Holds the
  // saved bill's id so the notice's retry can PATCH just that bill.
  const [savedWithoutReceipt, setSavedWithoutReceipt] = useState<string | null>(null);
  const [waitingForUpload, setWaitingForUpload] = useState(false);

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

  // Shared by handleSave and the post-save receipt retry, which re-sends
  // the whole bill because PATCH is a full replace.
  function buildBody(receiptUrl: string | null) {
    const base = {
      title: title.trim(),
      totalAmount: totalAmountSen,
      payerId,
      // Omitted rather than null when absent: the schema field is
      // .optional(), and absence is what means "no receipt".
      ...(receiptUrl ? { receiptUrl } : {}),
    };
    return splitMethod === "equal"
      ? { ...base, splitMethod: "equal" as const, participantIds: [...splitBetween] }
      : {
          ...base,
          splitMethod: "custom" as const,
          customShares: [...splitBetween].map((id) => ({
            memberId: id,
            shareAmount: parseAmount(customAmounts[id] ?? "", minorUnit),
          })),
        };
  }

  // Embedded in the desktop workspace (create mode + onSaved): refresh in
  // place and let the parent remount this form for the next entry, rather
  // than navigating to the event dashboard.
  function finishSave() {
    toast(mode === "create" ? "Bill added" : "Bill updated");
    if (onSaved && mode === "create") {
      setSubmitting(false);
      onSaved();
      return;
    }
    router.push(dashboardHref);
    router.refresh();
  }

  async function handleSave() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    // The receipt must never hold the bill hostage. Wait a bounded 10s for
    // an in-flight upload, then save regardless of how it went.
    setWaitingForUpload(receipt.state.status === "working");
    const receiptUrl = await receipt.settle(10_000);
    setWaitingForUpload(false);

    // A receipt was picked but did not land -- save anyway, then say so
    // rather than silently discarding a file the user watched attach.
    const lostReceipt = receiptUrl === null && receipt.state.status !== "empty";

    const body = buildBody(receiptUrl);

    try {
      const res = await fetch(
        mode === "create" ? `/api/events/${eventId}/bills` : `/api/bills/${initialBill!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        // The bills route 409s an archived event with a human-readable
        // message ("This event is archived and cannot have new bills") --
        // surface that instead of a generic failure, since this form stays
        // reachable (bookmark, back button, history) after its event is
        // archived. A 400 still returns Zod's flatten() object here, which
        // must not render -- only use body.error when it's a string.
        const body = await res.json().catch(() => null);
        const message = typeof body?.error === "string" ? body.error : null;
        toast(describeApiError(res.status, body), "error");
        setError(message ?? "Couldn't save that bill — check your connection and try again.");
        setSubmitting(false);
        return;
      }

      if (lostReceipt) {
        const saved = await res.json().catch(() => null);
        setSavedWithoutReceipt(saved?.bill?.id ?? initialBill?.id ?? null);
        setSubmitting(false);
        return;
      }

      finishSave();
    } catch {
      // A thrown error here is a transport failure, never a server
      // message -- its raw text is not user-facing copy.
      toast(NETWORK_ERROR_MESSAGE, "error");
      setError("Couldn't save that bill — check your connection and try again.");
      setSubmitting(false);
    }
  }

  // Retry from the post-save notice: re-upload, then PATCH just the saved
  // bill. The full body is still in memory, which satisfies PATCH's
  // full-replace contract.
  async function handleRetryReceipt() {
    if (!savedWithoutReceipt) return;
    setSubmitting(true);
    setError(null);
    receipt.retry();

    const receiptUrl = await receipt.settle(15_000);
    if (!receiptUrl) {
      setError("Still couldn't upload the receipt.");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch(`/api/bills/${savedWithoutReceipt}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildBody(receiptUrl)),
      });
      if (!res.ok) {
        setError("Saved the bill, but couldn't attach the receipt.");
        setSubmitting(false);
        return;
      }
    } catch {
      setError("Saved the bill, but couldn't attach the receipt.");
      setSubmitting(false);
      return;
    }

    finishSave();
  }

  const fields = (
    <>
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

        <ReceiptField receipt={receipt} />

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

        <div className={cn("flex w-fit gap-1 rounded-md bg-app-bg p-1 dark:bg-dark-card", compact ? "mb-3.5" : "mb-5")}>
          <button
            type="button"
            onClick={() => setSplitMethod("equal")}
            className={cn(
              "rounded-[10px] font-bold",
              compact ? "px-3 py-1.5 text-[12.5px]" : "px-4.5 py-2.5 text-[13.5px]",
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
              "rounded-[10px] font-bold",
              compact ? "px-3 py-1.5 text-[12.5px]" : "px-4.5 py-2.5 text-[13.5px]",
              splitMethod === "custom"
                ? "bg-forest text-cream dark:bg-dark-forest"
                : "text-muted dark:text-dark-muted",
            )}
          >
            Custom amounts
          </button>
        </div>

        {splitMethod === "equal" ? (
          <div className={cn("rounded-md border border-ink/8 bg-white dark:border-white/8 dark:bg-dark-card", compact ? "mb-3.5 px-3 py-3" : "mb-5 px-4.5 py-4")}>
            {[...splitBetween].map((id) => {
              const member = memberById.get(id)!;
              const share = equalShares?.find((s) => s.memberId === id);
              return (
                <div key={id} className={cn("flex items-center justify-between", compact ? "py-1" : "py-1.5")}>
                  <div className="flex items-center gap-2.5">
                    <InitialsAvatar name={member.name} color={member.avatarColor} size={compact ? 20 : 24} />
                    <span className={cn("text-ink dark:text-dark-text", compact ? "text-[12.5px]" : "text-[13.5px]")}>
                      {member.name}
                    </span>
                  </div>
                  <span className={cn("num text-ink dark:text-dark-text", compact ? "text-[13.5px]" : "text-[15px]")}>
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
            <div className={cn("mb-3.5 rounded-md border border-ink/8 bg-white dark:border-white/8 dark:bg-dark-card", compact ? "px-3 py-3" : "px-4.5 py-4")}>
              {[...splitBetween].map((id) => {
                const member = memberById.get(id)!;
                return (
                  <div key={id} className={cn("flex items-center justify-between", compact ? "py-1" : "py-1.5")}>
                    <div className="flex items-center gap-2.5">
                      <InitialsAvatar name={member.name} color={member.avatarColor} size={compact ? 20 : 24} />
                      <span className={cn("text-ink dark:text-dark-text", compact ? "text-[12.5px]" : "text-[13.5px]")}>
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

        {/* The bill is already saved at this point -- the receipt is the
            only thing outstanding, so this replaces Save rather than
            sitting alongside it. */}
        {savedWithoutReceipt ? (
          <div className="rounded-md border border-ink/8 bg-white p-4 dark:border-white/8 dark:bg-dark-card">
            <p className="mb-3 text-[13.5px] text-ink dark:text-dark-text">
              Bill saved — but the receipt didn&apos;t upload.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleRetryReceipt}
                disabled={submitting}
                className="rounded-md bg-forest px-5 py-2.5 text-[13.5px] font-bold text-cream disabled:opacity-60 dark:bg-dark-forest"
              >
                {submitting ? "Retrying…" : "Retry receipt"}
              </button>
              <button
                type="button"
                onClick={finishSave}
                className="rounded-md border border-ink/16 px-5 py-2.5 text-[13.5px] font-bold text-ink dark:border-white/16 dark:text-dark-text"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            // canSubmit deliberately carries no receipt condition -- the
            // optional attachment must never gate the money-critical action.
            disabled={!canSubmit}
            onClick={handleSave}
            className={cn(
              "w-full rounded-md py-4 text-center text-[15.5px] font-bold",
              canSubmit
                ? "bg-forest text-cream shadow-[0_8px_18px_-6px_rgba(22,58,46,0.5)] hover:bg-forest-hover dark:bg-dark-forest dark:hover:bg-dark-forest-hover"
                : "cursor-not-allowed bg-disabled text-disabled-text dark:bg-white/10 dark:text-white/30",
            )}
          >
            {waitingForUpload ? "Uploading receipt…" : submitting ? "Saving…" : "Save bill"}
          </button>
        )}
    </>
  );

  if (embedded) {
    return fields;
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
        {fields}
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

// Read-only detail for a bill (Screen Spec P5-03), reached for either of
// two independent reasons: the bill is settled (immutable for every role,
// CLAUDE.md rule 10), or the viewer isn't an editor. Both render the same
// Eye-led view -- the icon means "you're looking, not writing" either way
// -- and only the banner copy names which reason applies, since "settled"
// is a fact about the bill and "you can't edit" is a fact about the
// viewer.
//
// Deliberately no Lock icon anywhere on this page. There is no "unmark as
// settled" action in this codebase -- not a stub, not a disabled button,
// nothing -- and CLAUDE.md rule 10 makes settled bills immutable at the
// API layer with no reversal path today. A Lock icon here would visually
// promise a toggle that doesn't exist, which is exactly the bug the
// previous version of this view had (its copy literally said "unmark it
// as settled from Settle up," a flow that was never real). If a real
// unsettle feature gets designed and built, it needs its own affordance
// wired to an endpoint that actually exists -- not a re-skin of this one.
//
// Previously this rendered only the title and total, dimmed to 45%
// opacity, plus a disabled "Save bill" button -- a view so thin it read as
// a broken edit form rather than a bill you could inspect. That's fixed
// below with the full payer + split breakdown.
function ReadOnlyBillView({
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
  const settled = bill.status === "settled";

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-cream px-5 py-8 dark:bg-dark-bg">
      <ThemeToggle className="absolute top-5 right-5 sm:top-7 sm:right-9" />
      <div className="w-full max-w-[520px] rounded-lg bg-white p-7 shadow-[0_16px_36px_-20px_rgba(19,46,40,0.22)] sm:p-8 dark:bg-dark-card">
        <div className="mb-4 flex items-center gap-2.5">
          <Eye className="h-5 w-5 text-ink dark:text-dark-text" aria-hidden="true" />
          <h1 className="num text-[22px] text-ink dark:text-dark-text">{bill.title}</h1>
        </div>
        <div className="mb-5 flex items-center gap-2.5 rounded-md bg-cream px-4.5 py-4 dark:bg-dark-bg">
          {settled ? (
            <>
              <Eye className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <p className="text-[13px] leading-relaxed text-muted dark:text-dark-muted">
                This bill is <strong className="text-ink dark:text-dark-text">settled</strong> —
                view only.
              </p>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
              <p className="text-[13px] leading-relaxed text-muted dark:text-dark-muted">
                You can view this bill, but only an{" "}
                <strong className="text-ink dark:text-dark-text">editor</strong> can change it.
              </p>
            </>
          )}
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

        {/* Absent entirely when there is no receipt -- no "No receipt"
            empty state, and no block at all if the image fails to load. */}
        {bill.receiptUrl && <ReceiptThumbnail url={bill.receiptUrl} />}

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
