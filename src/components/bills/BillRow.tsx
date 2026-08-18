import Link from "next/link";
import { BillParticipants } from "@/components/bills/BillParticipants";
import type { ParticipantMember } from "@/lib/bill-participants";
import { formatMoney } from "@/lib/format";
import { Eye, Pencil, Trash2 } from "lucide-react";

export interface EventBillView {
  id: string;
  title: string;
  payerId: string;
  payerName: string;
  participants: ParticipantMember[];
  totalAmount: number;
  status: string;
}

// One bill row on the event dashboard (Screen Spec P4-01) and the desktop
// group workspace's per-event block. Extracted from EventDashboard so both
// surfaces render a bill identically. No client-only code -- the delete
// action is delegated to the parent via onRequestDelete.
export function BillRow({
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
    <div className="rounded-md border border-ink/7 bg-white px-4 py-3 sm:px-4.5 sm:py-3.5 dark:border-white/7 dark:bg-dark-card">
      {/* Row 1: title + amount. Row 2: payer/split meta + status + actions.
          Both rows truncate their own left side and never fight the
          right-side elements for space -- a long payer name used to wrap
          and land on top of the amount and action icons. */}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink sm:text-[15px] dark:text-dark-text">
          {bill.title}
        </p>
        <p className="num shrink-0 text-[16px] text-ink sm:text-[18px] dark:text-dark-text">
          {formatMoney(bill.totalAmount, currency)}
        </p>
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {/* Own line each, rather than one truncating "Paid by X · split N
            ways" string -- a long payer name used to force the whole line
            to wrap mid-word. */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10.5px] leading-tight text-muted-2 sm:text-[12.5px] dark:text-dark-muted">
            Paid by {bill.payerName}
          </p>
          <BillParticipants participants={bill.participants} className="mt-1" />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <span
            className={
              settled
                ? "rounded-full bg-mint-tint px-2.5 py-1 text-[10.5px] font-bold whitespace-nowrap text-emerald sm:px-3 sm:text-[11.5px] dark:bg-mint/16 dark:text-mint"
                : "rounded-full bg-cream px-2.5 py-1 text-[10.5px] font-bold whitespace-nowrap text-muted sm:px-3 sm:text-[11.5px] dark:bg-dark-bg dark:text-dark-muted"
            }
          >
            {settled ? "Settled" : "Unsettled"}
          </span>
          <div className="flex items-center gap-2 text-sm text-muted-2 sm:gap-2.5">
            {/* Eye = read-only detail, for whichever role doesn't have a
                better affordance here: everyone once the bill is settled
                (rule 10 makes it immutable regardless of role), or a
                viewer on an unsettled bill (they have no write access
                either way). Pencil/Trash stay editor-only, since they lead
                to the real write path. */}
            {settled ? (
              <Link
                href={`/g/${groupId}/events/${eventId}/bills/${bill.id}/edit`}
                title="View bill details"
                aria-label="View bill details"
              >
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              </Link>
            ) : canEdit ? (
              <>
                <Link
                  href={`/g/${groupId}/events/${eventId}/bills/${bill.id}/edit`}
                  title="Edit bill"
                  aria-label="Edit bill"
                >
                  <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                </Link>
                <button type="button" onClick={onRequestDelete} aria-label="Delete bill">
                  <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
                </button>
              </>
            ) : (
              <Link
                href={`/g/${groupId}/events/${eventId}/bills/${bill.id}/edit`}
                title="View bill details"
                aria-label="View bill details"
              >
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
