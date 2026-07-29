"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GroupHeader } from "@/components/group/GroupHeader";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatDateRange, formatMoney } from "@/lib/format";
import { cn } from "@/lib/cn";
import { MemberTabs } from "./MemberTabs";
import { Receipt } from "lucide-react";

interface MemberExpenseBillLineView {
  billId: string;
  title: string;
  totalAmount: number;
  payerId: string;
  payerName: string;
  isPayer: boolean;
  shareAmount: number;
  createdAt: string;
}

interface MemberExpenseEventView {
  id: string;
  name: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  share: number;
  paid: number;
  lines: MemberExpenseBillLineView[];
}

interface MemberExpenseViewProps {
  groupId: string;
  groupName: string;
  actorType: "member" | "visitor";
  member: { id: string; name: string; avatarColor: string; isActive: boolean };
  currencies: string[];
  events: MemberExpenseEventView[];
  initialEventId: string | null;
  initialCurrency: string | null;
}

// Screen Spec P4-06. Deliberately answers one question -- what has this
// member actually spent -- and nothing about balances or who-owes-whom
// (that's the sibling Balance tab, P4-07). One currency shown at a time;
// never summed or converted across currencies (CLAUDE.md rule 1). No "you"
// anywhere (CLAUDE.md rule 5): this screen reads identically for everyone
// with the link.
export function MemberExpenseView({
  groupId,
  groupName,
  actorType,
  member,
  currencies,
  events,
  initialEventId,
  initialCurrency,
}: MemberExpenseViewProps) {
  const [selectedCurrency, setSelectedCurrency] = useState(
    initialCurrency && currencies.includes(initialCurrency) ? initialCurrency : (currencies[0] ?? null),
  );
  const [expandedId, setExpandedId] = useState<string | null>(initialEventId);

  const eventsInCurrency = useMemo(
    () => events.filter((e) => e.currency === selectedCurrency),
    [events, selectedCurrency],
  );
  const totals = useMemo(
    () =>
      eventsInCurrency.reduce(
        (acc, e) => ({ share: acc.share + e.share, paid: acc.paid + e.paid }),
        { share: 0, paid: 0 },
      ),
    [eventsInCurrency],
  );

  const backHref = initialEventId ? `/g/${groupId}/events/${initialEventId}` : `/g/${groupId}/events`;

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
                {member.name}&rsquo;s expenses
              </h1>
              <p className="mt-0.5 text-[12.5px] text-muted sm:text-[13px] dark:text-dark-muted">
                {member.name}&rsquo;s share of every bill they appear on across {groupName}
                {events.length > 0 ? " — including trips that are already settled." : "."}
              </p>
            </div>
          </div>

          <MemberTabs groupId={groupId} memberId={member.id} />

          {events.length === 0 || !selectedCurrency ? (
            <EmptyExpensesState memberName={member.name} />
          ) : (
            <>
              {currencies.length > 1 && (
                <div className="mb-4 flex items-center justify-between gap-3 sm:mb-5">
                  <div className="inline-flex gap-1 rounded-md bg-app-bg p-1 dark:bg-dark-bg">
                    {currencies.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setSelectedCurrency(code)}
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
                Total share{currencies.length > 1 ? ` · ${selectedCurrency}` : ""}
              </p>
              <p className="num text-[28px] text-ink sm:text-[38px] dark:text-dark-text">
                {formatMoney(totals.share, selectedCurrency)}
              </p>
              <p className="mt-1.5 text-[13.5px] text-muted dark:text-dark-muted">
                {member.name} paid{" "}
                <span className="num text-ink dark:text-dark-text">
                  {formatMoney(totals.paid, selectedCurrency)}
                </span>{" "}
                of these bills themselves
              </p>
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
                <EventExpenseCard
                  key={event.id}
                  event={event}
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

function EmptyExpensesState({ memberName }: { memberName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint">
        <Receipt className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mb-1.5 text-[15px] font-bold text-ink dark:text-dark-text">No expenses yet</p>
      <p className="max-w-[320px] text-[13px] text-muted dark:text-dark-muted">
        {memberName} hasn&rsquo;t paid for or been split on any bills yet.
      </p>
    </div>
  );
}

function EventExpenseCard({
  event,
  expanded,
  onToggle,
}: {
  event: MemberExpenseEventView;
  expanded: boolean;
  onToggle: () => void;
}) {
  const dateRange = formatDateRange(event.startDate, event.endDate);

  return (
    <div className="rounded-lg border border-ink/7 bg-white px-4 py-3.5 sm:px-4.5 sm:py-4 dark:border-white/7 dark:bg-dark-card">
      <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-3 text-left">
        <div className="flex items-center gap-2.5">
          <span className="text-[12px] text-muted-2">{expanded ? "▾" : "▸"}</span>
          <div>
            <p className="text-[15px] font-bold text-ink dark:text-dark-text">{event.name}</p>
            <p className="text-[12.5px] text-muted-2">
              {dateRange ? `${dateRange} · ` : ""}
              {event.lines.length} bill{event.lines.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <p className="num text-[17px] text-ink dark:text-dark-text">{formatMoney(event.share, event.currency)}</p>
      </button>

      {expanded && (
        <div className="mt-3 divide-y divide-ink/8 border-t border-ink/8 dark:divide-white/8 dark:border-white/8">
          {event.lines.map((line) => (
            <div key={line.billId} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-ink dark:text-dark-text">{line.title}</p>
                <p className="mt-0.5 text-[12px] text-muted-2">
                  {formatMoney(line.totalAmount, event.currency)} total ·{" "}
                  {line.isPayer ? (
                    <span className="font-semibold text-emerald dark:text-mint">they paid</span>
                  ) : (
                    <>paid by {line.payerName}</>
                  )}
                </p>
              </div>
              <p className="num shrink-0 text-[14.5px] text-ink dark:text-dark-text">
                {formatMoney(line.shareAmount, event.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
