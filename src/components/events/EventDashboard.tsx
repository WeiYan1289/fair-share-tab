"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GroupHeader } from "@/components/group/GroupHeader";
import { ShareDialog } from "@/components/group/ShareDialog";
import { AddMemberModal } from "@/components/members/AddMemberModal";
import { DeactivateConfirmModal } from "@/components/members/DeactivateConfirmModal";
import { MemberChip } from "@/components/members/MemberChip";
import { DeleteBillConfirmModal } from "@/components/bills/DeleteBillConfirmModal";
import { formatDateRange, formatMoney } from "@/lib/format";
import { useCountUp } from "@/lib/useCountUp";
import { Link as LinkIcon, Lock, Pencil, Receipt, Trash2 } from "lucide-react";

interface EventMemberView {
  id: string;
  name: string;
  avatarColor: string;
  isActive: boolean;
  createdAt: string;
  balance: number;
}

interface EventBillView {
  id: string;
  title: string;
  payerId: string;
  payerName: string;
  splitCount: number;
  totalAmount: number;
  status: string;
}

interface EventView {
  id: string;
  groupId: string;
  name: string;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  totalSpend: number;
  members: EventMemberView[];
  bills: EventBillView[];
}

interface EventDashboardProps {
  groupId: string;
  groupName: string;
  viewerRole: "editor" | "viewer";
  event: EventView;
}

// Screen Spec P4-01 (light) / P4-02 (dark, via Tailwind's automatic
// prefers-color-scheme `dark:` variant) / P4-03 (empty states) / P7-01
// (read-only for viewer-role sessions).
export function EventDashboard({ groupId, groupName, viewerRole, event }: EventDashboardProps) {
  const router = useRouter();
  const canEdit = viewerRole === "editor";
  const [showShare, setShowShare] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<EventBillView | null>(null);
  const totalSpend = useCountUp(event.totalSpend);

  async function handleRename(memberId: string, name: string) {
    await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    router.refresh();
  }

  const dateRange = formatDateRange(event.startDate, event.endDate);

  return (
    <div className="min-h-screen bg-cream px-5 py-6 sm:px-9 sm:py-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[1160px]">
        <GroupHeader groupName={groupName} />

        <div className="mb-3 flex items-center justify-between">
          <Link
            href={`/g/${groupId}/events`}
            className="text-[13px] font-bold text-link dark:text-mint"
          >
            ← All events
          </Link>
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 rounded-md border border-ink/14 bg-white px-4 py-2 text-[12.5px] font-bold text-ink dark:border-white/14 dark:bg-dark-card dark:text-dark-text"
            >
              <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" /> Share
            </button>
          )}
        </div>

        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="num text-[28px] text-ink sm:text-[36px] dark:text-dark-text">
              {event.name}
            </h1>
            {dateRange && (
              <p className="mt-1 text-[13px] text-muted dark:text-dark-muted">
                {dateRange} · {event.members.length} member{event.members.length === 1 ? "" : "s"}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-[11.5px] tracking-wide text-muted-2 uppercase dark:text-dark-muted">
              Total spend
            </p>
            <p className="num text-[30px] text-ink sm:text-[38px] dark:text-dark-text">
              {formatMoney(totalSpend, event.currency)}
            </p>
          </div>
        </div>

        <p className="mb-3 text-[12.5px] font-bold tracking-wide text-muted-2 uppercase dark:text-dark-muted">
          Members
        </p>
        <div className="mb-8 flex gap-3 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {event.members.map((member) => (
            <MemberChip
              key={member.id}
              member={member}
              currency={event.currency}
              canEdit={canEdit}
              onRenamed={handleRename}
              onRequestDeactivate={(id, name) => setDeactivateTarget({ id, name })}
              onReactivated={() => router.refresh()}
            />
          ))}
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              aria-label="Add member"
              className="flex min-w-[64px] shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-ink/18 bg-app-bg px-3 py-2.5 text-muted sm:hidden dark:border-white/18 dark:bg-dark-card dark:text-dark-muted"
            >
              <span className="text-lg leading-none">+</span>
              <span className="text-[9.5px] font-bold">Add</span>
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              className="hidden min-w-[150px] items-center gap-2 rounded-md border border-dashed border-ink/18 bg-app-bg px-4.5 py-3 text-[13px] font-bold text-muted sm:flex dark:border-white/18 dark:bg-dark-card dark:text-dark-muted"
            >
              + Add member
            </button>
          )}
        </div>

        <div className="mb-3.5 flex items-center justify-between">
          <p className="text-[12.5px] font-bold tracking-wide text-muted-2 uppercase dark:text-dark-muted">
            Bills
          </p>
          {event.bills.length > 0 && (
            <div className="flex gap-2.5">
              <Link
                href={`/g/${groupId}/events/${event.id}/settle`}
                className="rounded-md border border-ink/16 bg-white px-5 py-2.5 text-[13.5px] font-bold text-ink dark:border-white/16 dark:bg-dark-card dark:text-dark-text"
              >
                Settle up
              </Link>
              {canEdit && (
                <Link
                  href={`/g/${groupId}/events/${event.id}/bills/new`}
                  className="rounded-md bg-forest px-5 py-2.5 text-[13.5px] font-bold text-cream shadow-[0_8px_18px_-6px_rgba(22,58,46,0.5)] hover:bg-forest-hover dark:bg-dark-forest"
                >
                  + Add bill
                </Link>
              )}
            </div>
          )}
        </div>

        {event.bills.length === 0 ? (
          <EmptyBillsState canEdit={canEdit} groupId={groupId} eventId={event.id} />
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

      {showShare && (
        <ShareDialog groupId={groupId} groupName={groupName} onClose={() => setShowShare(false)} />
      )}
      {showAddMember && (
        <AddMemberModal
          eventId={event.id}
          onClose={() => setShowAddMember(false)}
          onAdded={() => {
            setShowAddMember(false);
            router.refresh();
          }}
        />
      )}
      {deactivateTarget && (
        <DeactivateConfirmModal
          memberId={deactivateTarget.id}
          memberName={deactivateTarget.name}
          onClose={() => setDeactivateTarget(null)}
          onDeactivated={() => {
            setDeactivateTarget(null);
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
    </div>
  );
}

function EmptyBillsState({
  canEdit,
  groupId,
  eventId,
}: {
  canEdit: boolean;
  groupId: string;
  eventId: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md bg-white px-6 py-11 text-center dark:bg-dark-card">
      <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint">
        <Receipt className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mb-1.5 text-[15px] font-bold text-ink dark:text-dark-text">No bills yet</p>
      <p className="mb-4 max-w-[320px] text-[13px] text-muted dark:text-dark-muted">
        Log your first expense to start tracking who owes what.
      </p>
      {canEdit && (
        <Link
          href={`/g/${groupId}/events/${eventId}/bills/new`}
          className="rounded-md bg-forest px-5.5 py-3 text-[13.5px] font-bold text-cream dark:bg-dark-forest"
        >
          + Add bill
        </Link>
      )}
    </div>
  );
}

function BillRow({
  bill,
  groupId,
  eventId,
  currency,
  canEdit,
  onRequestDelete,
}: {
  bill: EventBillView;
  groupId: string;
  eventId: string;
  currency: string;
  canEdit: boolean;
  onRequestDelete: () => void;
}) {
  const settled = bill.status === "settled";
  return (
    <div className="flex items-center justify-between rounded-md border border-ink/7 bg-white px-4.5 py-3.5 dark:border-white/7 dark:bg-dark-card">
      <div>
        <p className="text-[15px] font-bold text-ink dark:text-dark-text">{bill.title}</p>
        <p className="mt-0.5 text-[12.5px] text-muted-2 dark:text-dark-muted">
          Paid by {bill.payerName} · split {bill.splitCount} ways
        </p>
      </div>
      <div className="flex items-center gap-4">
        <p className="num text-[18px] text-ink dark:text-dark-text">
          {formatMoney(bill.totalAmount, currency)}
        </p>
        <span
          className={
            settled
              ? "rounded-full bg-mint-tint px-3 py-1 text-[11.5px] font-bold whitespace-nowrap text-emerald dark:bg-mint/16 dark:text-mint"
              : "rounded-full bg-cream px-3 py-1 text-[11.5px] font-bold whitespace-nowrap text-muted dark:bg-dark-bg dark:text-dark-muted"
          }
        >
          {settled ? "Settled" : "Unsettled"}
        </span>
        {canEdit && (
          <div className="flex items-center gap-2.5 text-sm text-muted-2">
            <Link
              href={`/g/${groupId}/events/${eventId}/bills/${bill.id}/edit`}
              title={settled ? "Settled — view only" : "Edit bill"}
            >
              {settled ? (
                <Lock className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pencil className="h-4 w-4" aria-hidden="true" />
              )}
            </Link>
            {!settled && (
              <button type="button" onClick={onRequestDelete} aria-label="Delete bill">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
