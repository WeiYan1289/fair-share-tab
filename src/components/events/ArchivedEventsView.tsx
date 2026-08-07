"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GroupHeader } from "@/components/group/GroupHeader";
import { RestoreButton } from "@/components/ui/RestoreButton";
import { formatMoney } from "@/lib/format";

interface ArchivedEventSummary {
  id: string;
  name: string;
  currency: string;
  totalSpend: number;
  billCount: number;
  memberCount: number;
  unsettledAmount: number;
  // Pre-formatted server-side (e.g. "6 Aug"), not a raw timestamp -- see
  // the page.tsx comment for why formatting must happen exactly once, on
  // the server, to avoid a UTC-vs-UTC+8 hydration mismatch.
  archivedAtLabel: string | null;
}

interface ArchivedEventsViewProps {
  groupId: string;
  groupName: string;
  actorType: "member" | "visitor";
  viewerRole: "editor" | "viewer";
  events: ArchivedEventSummary[];
}

// Read-only ledger for archived events (archived-readonly plan, T3). This
// is deliberately NOT the card grid the active events list uses -- a ruled
// list reads as a record, not something to poke at, which is the point:
// the only interactive control per row is its Restore button.
export function ArchivedEventsView({
  groupId,
  groupName,
  actorType,
  viewerRole,
  events,
}: ArchivedEventsViewProps) {
  const canRestore = viewerRole === "editor";

  return (
    <div className="min-h-screen bg-cream px-5 py-6 sm:px-9 sm:py-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[720px]">
        <GroupHeader groupId={groupId} groupName={groupName} actorType={actorType} />

        <Link
          href={`/g/${groupId}/events`}
          className="mb-4 block text-[13px] font-bold text-link dark:text-mint"
        >
          ← Back to events
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="num text-[22px] text-ink sm:text-[34px] dark:text-dark-text">
            Archived events
          </h1>
          <p className="mt-1.5 max-w-[480px] text-[13px] leading-relaxed text-muted sm:text-[13.5px] dark:text-dark-muted">
            {events.length} event{events.length === 1 ? "" : "s"}. None of this counts toward
            anyone&rsquo;s balance, and archived events can&rsquo;t be edited or settled. Restore
            one to pick it back up.
          </p>
        </div>

        {events.length === 0 ? (
          <EmptyState groupId={groupId} />
        ) : (
          <div className="divide-y divide-ink/8 border-t border-b border-ink/8 dark:divide-white/8 dark:border-white/8">
            {events.map((event) => (
              <ArchivedEventRow key={event.id} event={event} canRestore={canRestore} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ groupId }: { groupId: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <p className="mb-2.5 text-[15px] font-bold text-ink dark:text-dark-text">
        Nothing archived yet
      </p>
      <p className="mb-6 max-w-[340px] text-[13px] leading-relaxed text-muted dark:text-dark-muted">
        Events you archive from the events list will show up here.
      </p>
      <Link href={`/g/${groupId}/events`} className="text-[13px] font-bold text-link dark:text-mint">
        ← Back to events
      </Link>
    </div>
  );
}

function ArchivedEventRow({
  event,
  canRestore,
}: {
  event: ArchivedEventSummary;
  canRestore: boolean;
}) {
  const router = useRouter();
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const metaParts = [
    `${event.billCount} bill${event.billCount === 1 ? "" : "s"}`,
    `${event.memberCount} member${event.memberCount === 1 ? "" : "s"}`,
  ];
  if (event.archivedAtLabel) {
    metaParts.push(`archived ${event.archivedAtLabel}`);
  }

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (!res.ok) throw new Error("restore failed");
      router.refresh();
    } catch {
      setRestoreError("Couldn't restore — check your connection and try again.");
      setRestoring(false);
    }
  }

  return (
    // A plain div, not a Link -- the row itself is inert (design intent: a
    // ruled record, not a tappable card). The only interactive control is
    // the Restore button below.
    <div className="flex items-start justify-between gap-3 py-4 sm:items-center sm:gap-4 sm:py-5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-ink sm:text-[16px] dark:text-dark-text">
          {event.name}
        </p>
        <p className="mt-0.5 text-[11.5px] text-muted sm:text-[12.5px] dark:text-dark-muted">
          {metaParts.join(" · ")}
        </p>
        {event.unsettledAmount > 0 && (
          <span className="mt-1.5 inline-block rounded-full bg-coral-tint px-2.5 py-1 text-[10.5px] font-bold whitespace-nowrap text-coral sm:mt-2 sm:text-[11px] dark:bg-coral/10">
            {formatMoney(event.unsettledAmount, event.currency)} still unsettled
          </span>
        )}
      </div>

      {/* Below sm this stacks: the total sits on the title's line and the
          control drops beneath it, so the pair occupies one narrow column
          instead of a wide strip. That leaves the meta line the width it
          needs even when the figure runs to eight digits, as a zero-decimal
          currency like KRW can. From sm up there is room to sit them side
          by side. */}
      <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
        <p className="num text-[14px] whitespace-nowrap text-ink sm:text-[18px] dark:text-dark-text">
          {formatMoney(event.totalSpend, event.currency)}
        </p>
        {canRestore && (
          <div className="relative">
            <RestoreButton
              label={`Restore ${event.name}`}
              restoring={restoring}
              onClick={handleRestore}
            />
            {restoreError && (
              <p className="absolute top-full right-0 mt-1 w-[180px] text-right text-[11px] leading-snug text-coral">
                {restoreError}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
