"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GroupHeader } from "@/components/group/GroupHeader";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { cn } from "@/lib/cn";
import { DEFAULT_CURRENCY } from "@/lib/currency";
import { formatMoney } from "@/lib/format";
import type { MemberCombinedCurrency } from "@/lib/expenses";
import { MemberTabs } from "./MemberTabs";
import { MemberTransferRow } from "./MemberTransferRow";

interface MemberBalanceTransferView {
  otherMemberId: string;
  otherName: string;
  direction: "pays" | "receives";
  amount: number;
}

interface MemberBalanceEventView {
  id: string;
  name: string;
  currency: string;
  net: number;
  transfers: MemberBalanceTransferView[];
}

interface MemberBalanceViewProps {
  groupId: string;
  groupName: string;
  actorType: "member" | "visitor";
  member: { id: string; name: string; avatarColor: string; isActive: boolean };
  events: MemberBalanceEventView[];
  /** True when this member is also involved in an archived event -- those
   * events' balances are excluded from `events` above, so the copy needs to
   * say so rather than imply nothing is owed anywhere (CLAUDE.md rule 5). */
  hasArchivedEvents: boolean;
  /** Cross-event combined position per currency, shown as the summary above
   * the per-event breakdown. Only currencies where the member spans >= 2
   * active events with a non-zero position appear (cross-event settlement
   * design, "Member Balance screen -> Combined"). */
  combined: MemberCombinedCurrency[];
}

function currencyFirstSort(a: string, b: string): number {
  if (a === DEFAULT_CURRENCY) return -1;
  if (b === DEFAULT_CURRENCY) return 1;
  return a.localeCompare(b);
}

// Screen Spec P4-07, sibling to the Expenses tab (P4-06) and now sharing its
// shape: one currency shown at a time (never summed across currencies,
// CLAUDE.md rule 1), and the per-event breakdown as collapsible cards so a
// member in many trips isn't an endless scroll. Only unsettled events appear
// at all -- a settled event's debts are already resolved, so it's omitted
// rather than shown at zero. Archived events are excluded from this math
// entirely (spec 2026-08-06 feature B). No "you" anywhere (rule 5).
export function MemberBalanceView({
  groupId,
  groupName,
  actorType,
  member,
  events,
  hasArchivedEvents,
  combined,
}: MemberBalanceViewProps) {
  const backHref = `/g/${groupId}/events`;

  const currencies = useMemo(() => {
    const set = new Set(events.map((e) => e.currency));
    return [...set].sort(currencyFirstSort);
  }, [events]);

  const [selectedCurrency, setSelectedCurrency] = useState(currencies[0] ?? null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const eventsInCurrency = useMemo(
    () => events.filter((e) => e.currency === selectedCurrency),
    [events, selectedCurrency],
  );
  const combinedForCurrency = combined.find((c) => c.currency === selectedCurrency) ?? null;
  // Sum of per-event nets equals the member's combined net for the currency,
  // whether there are two events (== combined) or one (== that event's net).
  const summaryNet = eventsInCurrency.reduce((sum, e) => sum + e.net, 0);

  return (
    <div className="min-h-screen bg-cream px-5 py-6 sm:px-9 sm:py-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[720px]">
        <GroupHeader groupId={groupId} groupName={groupName} actorType={actorType} />

        <Link href={backHref} className="mb-4 block text-[13px] font-bold text-link dark:text-mint">
          ← Back
        </Link>

        <div className="rounded-lg border border-ink/7 bg-white p-4 sm:p-7 dark:border-white/7 dark:bg-dark-card">
          <div className="mb-4 flex items-center gap-3 sm:mb-5 sm:gap-3.5">
            <InitialsAvatar name={member.name} color={member.avatarColor} size={52} className="text-lg" />
            <div>
              <h1 className="num text-[20px] text-ink sm:text-[26px] dark:text-dark-text">
                {member.name}&rsquo;s balance
              </h1>
              <p className="mt-0.5 text-[12.5px] text-muted sm:text-[13px] dark:text-dark-muted">
                What&rsquo;s still outstanding for {member.name} across every active event in{" "}
                {groupName}. Settled trips don&rsquo;t appear here.
              </p>
              {hasArchivedEvents && (
                <p className="mt-1 text-[11.5px] text-muted-2">
                  Archived events aren&rsquo;t counted here.
                </p>
              )}
            </div>
          </div>

          <MemberTabs groupId={groupId} memberId={member.id} />

          {eventsInCurrency.length === 0 || !selectedCurrency ? (
            <EmptyBalanceState memberName={member.name} hasArchivedEvents={hasArchivedEvents} />
          ) : (
            <>
              {currencies.length > 1 && (
                <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
                  <div className="inline-flex gap-1 rounded-md bg-app-bg p-1 dark:bg-dark-bg">
                    {currencies.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => {
                          setSelectedCurrency(code);
                          setExpandedId(null);
                        }}
                        className={cn(
                          "rounded-[10px] px-4 py-1.5 text-[12.5px] font-bold",
                          code === selectedCurrency
                            ? "bg-forest text-cream dark:bg-dark-forest"
                            : "text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text",
                        )}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                  <p className="text-[12px] text-muted-2">
                    {eventsInCurrency.length} event{eventsInCurrency.length === 1 ? "" : "s"} in{" "}
                    {selectedCurrency}
                  </p>
                </div>
              )}

              <p className="mb-1 text-[11.5px] font-bold tracking-wide text-muted-2 uppercase">
                {member.name} {summaryNet > 0 ? "can receive" : "needs to pay"}
                {currencies.length > 1 ? ` · ${selectedCurrency}` : ""}
              </p>
              <p
                className={cn(
                  "num text-[28px] sm:text-[38px]",
                  summaryNet > 0 && "text-emerald dark:text-mint",
                  summaryNet < 0 && "text-coral",
                )}
              >
                {summaryNet > 0 ? "+" : "-"}
                {formatMoney(Math.abs(summaryNet), selectedCurrency)}
              </p>

              {/* Combined (>= 2 events): the netted "who this member pays /
                  receives from" -- the fewest transfers. With a single event
                  it would duplicate the one card below, so it's omitted. */}
              {combinedForCurrency && (
                <>
                  <p className="mt-3 mb-1 text-[11.5px] text-muted-2">
                    Combined across {combinedForCurrency.eventCount} events — the fewest transfers:
                  </p>
                  <div className="divide-y divide-ink/8 border-t border-ink/8 dark:divide-white/8 dark:border-white/8">
                    {combinedForCurrency.transfers.map((t) => (
                      <MemberTransferRow
                        key={t.otherMemberId}
                        memberName={member.name}
                        otherName={t.otherName}
                        direction={t.direction}
                        amount={t.amount}
                        currency={combinedForCurrency.currency}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {eventsInCurrency.length > 0 && (
          <>
            <p className="mt-5 mb-2.5 text-[12.5px] font-bold tracking-wide text-muted-2 uppercase sm:mt-7 sm:mb-3">
              By event
            </p>
            <div className="flex flex-col gap-2.5">
              {eventsInCurrency.map((event) => (
                <EventBalanceCard
                  key={event.id}
                  event={event}
                  memberName={member.name}
                  expanded={expandedId === event.id}
                  onToggle={() => setExpandedId((prev) => (prev === event.id ? null : event.id))}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyBalanceState({ memberName, hasArchivedEvents }: { memberName: string; hasArchivedEvents: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint">
        <span className="text-2xl">✓</span>
      </div>
      <p className="mb-1.5 text-[15px] font-bold text-ink dark:text-dark-text">All settled up</p>
      <p className="max-w-[320px] text-[13px] text-muted dark:text-dark-muted">
        {memberName} has nothing outstanding in any active event right now.
      </p>
      {hasArchivedEvents && (
        <p className="mt-1 max-w-[320px] text-[11.5px] text-muted-2">
          Archived events aren&rsquo;t counted here.
        </p>
      )}
    </div>
  );
}

// One event's outstanding position for this member, collapsed to its net by
// default (mirrors the Expenses tab's EventExpenseCard) and expanding to the
// transfers that settle it. Same MemberTransferRow as the Combined summary so
// a transfer reads identically wherever it appears (rule 5).
function EventBalanceCard({
  event,
  memberName,
  expanded,
  onToggle,
}: {
  event: MemberBalanceEventView;
  memberName: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-lg border border-ink/7 bg-white px-4 py-3.5 sm:px-4.5 sm:py-4 dark:border-white/7 dark:bg-dark-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-muted-2">{expanded ? "▾" : "▸"}</span>
          <div>
            <p className="text-[15px] font-bold text-ink dark:text-dark-text">{event.name}</p>
            <p className="text-[12.5px] text-muted-2">
              {memberName} {event.net > 0 ? "gets back" : "needs to pay"}
            </p>
          </div>
        </div>
        <p
          className={cn(
            "num text-[17px]",
            event.net > 0 && "text-emerald dark:text-mint",
            event.net < 0 && "text-coral",
          )}
        >
          {event.net > 0 ? "+" : "-"}
          {formatMoney(Math.abs(event.net), event.currency)}
        </p>
      </button>

      {expanded && (
        <div className="mt-3 divide-y divide-ink/8 border-t border-ink/8 dark:divide-white/8 dark:border-white/8">
          {event.transfers.map((t) => (
            <MemberTransferRow
              key={t.otherMemberId}
              memberName={memberName}
              otherName={t.otherName}
              direction={t.direction}
              amount={t.amount}
              currency={event.currency}
            />
          ))}
        </div>
      )}
    </div>
  );
}
