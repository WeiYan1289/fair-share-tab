import Link from "next/link";
import { GroupHeader } from "@/components/group/GroupHeader";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
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
}

// Screen Spec P4-07, sibling to the Expenses tab (P4-06). Only unsettled
// events appear here at all -- a settled event's debts are already
// resolved via its transfers, so it's simply omitted rather than shown at
// zero (mirrors getEventDetail's own unsettled-only balance). Archived
// events are excluded from this math entirely (spec 2026-08-06 feature B),
// so every claim below is scoped to active events, not "every event".
export function MemberBalanceView({
  groupId,
  groupName,
  actorType,
  member,
  events,
  hasArchivedEvents,
}: MemberBalanceViewProps) {
  const backHref = `/g/${groupId}/events`;

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

          {events.length === 0 ? (
            <EmptyBalanceState memberName={member.name} hasArchivedEvents={hasArchivedEvents} />
          ) : (
            <div className="flex flex-col gap-4 sm:gap-6">
              {events.map((event) => (
                <EventBalanceSection key={event.id} event={event} memberName={member.name} />
              ))}
            </div>
          )}
        </div>
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

function EventBalanceSection({ event, memberName }: { event: MemberBalanceEventView; memberName: string }) {
  const netColor = cn(
    "num text-[28px] sm:text-[38px]",
    event.net > 0 && "text-emerald dark:text-mint",
    event.net < 0 && "text-coral",
  );

  return (
    <div>
      <p className="mb-1 text-[11.5px] font-bold tracking-wide text-muted-2 uppercase">
        {memberName} {event.net > 0 ? "gets back" : "needs to pay"} · {event.name}
      </p>
      <p className={netColor}>
        {event.net > 0 ? "+" : "-"}
        {formatMoney(Math.abs(event.net), event.currency)}
      </p>

      <div className="mt-4 divide-y divide-ink/8 border-t border-ink/8 dark:divide-white/8 dark:border-white/8">
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
    </div>
  );
}
