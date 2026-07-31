import Link from "next/link";
import { GroupHeader } from "@/components/group/GroupHeader";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatMoney } from "@/lib/format";
import { MemberTransferRow } from "./MemberTransferRow";
import { Receipt } from "lucide-react";

interface MemberActivityBillLineView {
  billId: string;
  title: string;
  totalAmount: number;
  payerId: string;
  payerName: string;
  isPayer: boolean;
  shareAmount: number;
  createdAt: string;
}

interface MemberActivityTransferView {
  otherMemberId: string;
  otherName: string;
  direction: "pays" | "receives";
  amount: number;
}

interface MemberEventActivityViewProps {
  groupId: string;
  groupName: string;
  actorType: "member" | "visitor";
  member: { id: string; name: string; avatarColor: string; isActive: boolean };
  event: { id: string; name: string; currency: string };
  share: number;
  paid: number;
  net: number;
  lines: MemberActivityBillLineView[];
  transfers: MemberActivityTransferView[];
}

// The event dashboard's member-chip destination: everything about one
// member in exactly this one event -- their bills, their share, and what
// settling this event would move for them. Deliberately a single page, not
// tabs like the cross-event Expenses/Balance screens (MemberExpenseView /
// MemberBalanceView) -- one event's worth of data is small enough that
// splitting it across two screens would just be friction, and having a
// visibly different shape from those two screens is itself part of what
// keeps "this event" from being confused with "every event".
export function MemberEventActivityView({
  groupId,
  groupName,
  actorType,
  member,
  event,
  share,
  paid,
  net,
  lines,
  transfers,
}: MemberEventActivityViewProps) {
  const backHref = `/g/${groupId}/events/${event.id}`;

  return (
    <div className="min-h-screen bg-cream px-5 py-6 sm:px-9 sm:py-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[720px]">
        <GroupHeader groupId={groupId} groupName={groupName} actorType={actorType} />

        <Link href={backHref} className="mb-4 block text-[13px] font-bold text-link dark:text-mint">
          ← Back to {event.name}
        </Link>

        <div className="rounded-lg border border-ink/7 bg-white p-4 sm:p-7 dark:border-white/7 dark:bg-dark-card">
          <div className="mb-4 flex items-center gap-3 sm:mb-5 sm:gap-3.5">
            <InitialsAvatar name={member.name} color={member.avatarColor} size={52} className="text-lg" />
            <div>
              <h1 className="num text-[20px] text-ink sm:text-[26px] dark:text-dark-text">
                {member.name}&rsquo;s activity in {event.name}
              </h1>
              <p className="mt-0.5 text-[12.5px] text-muted sm:text-[13px] dark:text-dark-muted">
                Bills, spend, and settlement for {member.name} in {event.name} only — nothing
                from their other events.
              </p>
            </div>
          </div>

          {lines.length === 0 ? (
            <EmptyActivityState memberName={member.name} eventName={event.name} />
          ) : (
            <>
              <p className="mb-1 text-[11.5px] font-bold tracking-wide text-muted-2 uppercase">
                Their share in this event
              </p>
              <p className="num text-[28px] text-ink sm:text-[38px] dark:text-dark-text">
                {formatMoney(share, event.currency)}
              </p>
              <p className="mt-1.5 text-[13.5px] text-muted dark:text-dark-muted">
                {member.name} paid{" "}
                <span className="num text-ink dark:text-dark-text">{formatMoney(paid, event.currency)}</span> of
                these bills themselves
              </p>

              {net !== 0 && (
                <div className="mt-5 border-t border-ink/8 pt-4 sm:mt-6 dark:border-white/8">
                  <p className="mb-1 text-[11.5px] font-bold tracking-wide text-muted-2 uppercase">
                    {net > 0 ? "Owed to" : "Owed by"} {member.name} in this event
                  </p>
                  <p
                    className={`num text-[22px] sm:text-[28px] ${net > 0 ? "text-emerald dark:text-mint" : "text-coral"}`}
                  >
                    {net > 0 ? "+" : "-"}
                    {formatMoney(Math.abs(net), event.currency)}
                  </p>
                  <div className="mt-3 divide-y divide-ink/8 border-t border-ink/8 dark:divide-white/8 dark:border-white/8">
                    {transfers.map((t) => (
                      <MemberTransferRow
                        key={t.otherMemberId}
                        memberName={member.name}
                        otherName={t.otherName}
                        direction={t.direction}
                        amount={t.amount}
                        currency={event.currency}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {lines.length > 0 && (
          <>
            <p className="mt-5 mb-2.5 text-[12.5px] font-bold tracking-wide text-muted-2 uppercase sm:mt-7 sm:mb-3">
              Bills in this event
            </p>
            <div className="rounded-lg border border-ink/7 bg-white px-4 dark:border-white/7 dark:bg-dark-card">
              <div className="divide-y divide-ink/8 dark:divide-white/8">
                {lines.map((line) => (
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
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyActivityState({ memberName, eventName }: { memberName: string; eventName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint">
        <Receipt className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mb-1.5 text-[15px] font-bold text-ink dark:text-dark-text">No activity yet</p>
      <p className="max-w-[320px] text-[13px] text-muted dark:text-dark-muted">
        {memberName} hasn&rsquo;t paid for or been split on any bill in {eventName} yet.
      </p>
    </div>
  );
}
