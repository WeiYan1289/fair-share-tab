"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GroupHeader } from "@/components/group/GroupHeader";
import { ShareDialog } from "@/components/group/ShareDialog";
import { AddMemberModal } from "@/components/members/AddMemberModal";
import { DeactivateConfirmModal } from "@/components/members/DeactivateConfirmModal";
import { MemberChip, type ChipMember } from "@/components/members/MemberChip";
import { cn } from "@/lib/cn";
import { colorForSeed } from "@/lib/constants";
import { formatDateRange, formatMoney } from "@/lib/format";
import { setGroupView } from "@/lib/view-cookie";
import type { GroupCurrencyOverview } from "@/lib/expenses";
import { CreateEventModal } from "./CreateEventModal";
import { EditEventModal } from "./EditEventModal";
import { ArchiveEventModal } from "./ArchiveEventModal";
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover, type Key } from "react-aria-components";
import { Archive, ChevronRight, Link as LinkIcon, MoreVertical, Pencil } from "lucide-react";

interface EventSummary {
  id: string;
  name: string;
  currency: string;
  /** ISO yyyy-mm-dd, or null when the event has no dates set. Only the edit
   * modal reads these -- the card itself doesn't show dates. */
  startDate: string | null;
  endDate: string | null;
  status: "active" | "archived";
  memberCount: number;
  totalSpend: number;
  unsettledAmount: number;
  unsettledCount: number;
  settlementState: "empty" | "settled" | "unsettled";
}

interface EventsListViewProps {
  groupId: string;
  groupName: string;
  viewerRole: "editor" | "viewer";
  actorType: "member" | "visitor";
  saveLinkToken: string | null;
  events: EventSummary[];
  members: ChipMember[];
  overviews: GroupCurrencyOverview[];
}

// Screen Spec P3-02 (populated) / P3-03 (empty state).
export function EventsListView({
  groupId,
  groupName,
  viewerRole,
  actorType,
  saveLinkToken,
  events,
  members,
  overviews,
}: EventsListViewProps) {
  const router = useRouter();
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [editEventTarget, setEditEventTarget] = useState<EventSummary | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<EventSummary | null>(null);
  const canEdit = viewerRole === "editor";
  const activeEvents = events.filter((e) => e.status === "active");
  const archivedEvents = events.filter((e) => e.status === "archived");

  function goToWorkspace() {
    setGroupView("workspace");
    router.push(`/g/${groupId}/workspace`);
  }

  async function handleRename(memberId: string, name: string) {
    await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    router.refresh();
  }

  // The token arrives as a one-time query param from the /g/{token} redirect
  // (CLAUDE.md rule 8: never let it sit persistently in the address bar) —
  // strip it immediately so a refresh or re-visit never shows it again.
  useEffect(() => {
    if (saveLinkToken !== null) {
      router.replace(`/g/${groupId}/events`);
    }
  }, [saveLinkToken, groupId, router]);

  return (
    <div className="min-h-screen bg-cream px-5 py-6 sm:px-9 sm:py-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[1160px]">
        <GroupHeader groupId={groupId} groupName={groupName} actorType={actorType} />

        <div className="mb-4 flex items-center gap-3">
          {actorType === "member" && (
            <Link
              href="/account/groups"
              className="text-[13px] font-bold text-link dark:text-mint"
            >
              ← All groups
            </Link>
          )}
          <div className="ml-auto flex items-center gap-2.5">
            {/* Desktop-only: switch to the one-page workspace and remember it. */}
            <div className="hidden overflow-hidden rounded-md border border-ink/16 lg:inline-flex dark:border-white/16">
              <span className="bg-forest px-3.5 py-2 text-[12.5px] font-bold text-cream dark:bg-dark-forest">
                Classic
              </span>
              <button
                type="button"
                onClick={goToWorkspace}
                className="px-3.5 py-2 text-[12.5px] font-bold text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text"
              >
                One-page
              </button>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowShare(true)}
                title="Copy or send this group's link — the only way back in without an account"
                className="flex items-center gap-1.5 rounded-md border border-ink/14 bg-white px-4 py-2 text-[12.5px] font-bold text-ink dark:border-white/14 dark:bg-dark-card dark:text-dark-text"
              >
                <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" /> Share
              </button>
            )}
          </div>
        </div>

        {members.length > 0 && (
          <>
            <p className="mb-3 text-[12.5px] font-bold tracking-wide text-muted-2 uppercase dark:text-dark-muted">
              Members
            </p>
            <div className="mb-6 flex gap-3 overflow-x-auto pb-1 sm:mb-8 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {members.map((member) => (
                <MemberChip
                  key={member.id}
                  member={member}
                  groupId={groupId}
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
          </>
        )}

        {activeEvents.length === 0 && archivedEvents.length === 0 ? (
          <EmptyState canEdit={canEdit} onCreate={() => setShowCreateEvent(true)} />
        ) : (
          <>
            {overviews.some((o) => o.transfers.length > 0) && (
              <div className="mb-6 grid grid-cols-1 gap-4 sm:mb-8 sm:grid-cols-2">
                {overviews
                  .filter((o) => o.transfers.length > 0)
                  .map((overview) => (
                    <OverallPanel
                      key={overview.currency}
                      groupId={groupId}
                      canEdit={canEdit}
                      overview={overview}
                    />
                  ))}
              </div>
            )}

            <div className="mb-6 flex items-end justify-between sm:mb-[30px]">
              <div>
                <h1 className="num text-[22px] text-ink sm:text-[34px] dark:text-dark-text">
                  Your events
                </h1>
                <p className="mt-1.5 text-[13px] text-muted sm:text-[13.5px] dark:text-dark-muted">
                  {activeEvents.length} event{activeEvents.length === 1 ? "" : "s"}
                </p>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setShowCreateEvent(true)}
                  className="hidden rounded-md bg-forest px-6 py-3.5 text-sm font-bold text-cream shadow-[0_8px_20px_-6px_rgba(22,58,46,0.5)] hover:bg-forest-hover sm:block dark:bg-dark-forest"
                >
                  + Create event
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              {activeEvents.map((event) => (
                <EventCard
                  key={event.id}
                  groupId={groupId}
                  event={event}
                  canEdit={canEdit}
                  onRequestEdit={setEditEventTarget}
                  onRequestArchive={setArchiveTarget}
                />
              ))}
            </div>

            {archivedEvents.length > 0 && (
              <Link
                href={`/g/${groupId}/events/archived`}
                className="mt-10 flex items-center gap-1.5 text-[13px] font-bold text-muted-2 dark:text-dark-muted"
              >
                Archived events · {archivedEvents.length}
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </>
        )}
      </div>

      {canEdit && (activeEvents.length > 0 || archivedEvents.length > 0) && (
        <button
          type="button"
          onClick={() => setShowCreateEvent(true)}
          aria-label="Create event"
          className="fixed right-5 bottom-8 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-3xl text-cream shadow-[0_10px_24px_-6px_rgba(22,58,46,0.55)] sm:hidden dark:bg-dark-forest"
        >
          +
        </button>
      )}

      {showCreateEvent && (
        <CreateEventModal groupId={groupId} onClose={() => setShowCreateEvent(false)} />
      )}
      {editEventTarget && (
        <EditEventModal
          eventId={editEventTarget.id}
          currentName={editEventTarget.name}
          currentStartDate={editEventTarget.startDate}
          currentEndDate={editEventTarget.endDate}
          currentCurrency={editEventTarget.currency}
          hasBills={editEventTarget.settlementState !== "empty"}
          onClose={() => setEditEventTarget(null)}
          onSaved={() => {
            setEditEventTarget(null);
            router.refresh();
          }}
        />
      )}
      {archiveTarget && (
        <ArchiveEventModal
          event={archiveTarget}
          onClose={() => setArchiveTarget(null)}
          onArchived={() => {
            setArchiveTarget(null);
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
      {showShare && (
        <ShareDialog
          groupId={groupId}
          groupName={groupName}
          actorType={actorType}
          onClose={() => setShowShare(false)}
        />
      )}
      {showAddMember && (
        <AddMemberModal
          scope={{ type: "group", groupId }}
          onClose={() => setShowAddMember(false)}
          onAdded={() => {
            setShowAddMember(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function EmptyState({ canEdit, onCreate }: { canEdit: boolean; onCreate: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-mint-tint dark:bg-mint/16">
        <div className="relative h-8 w-8 rounded-[9px] border-[3px] border-forest dark:border-mint">
          <span className="absolute top-1/2 left-1/2 h-[3px] w-[15px] -translate-x-1/2 -translate-y-1/2 bg-forest dark:bg-mint" />
          <span className="absolute top-1/2 left-1/2 h-[15px] w-[3px] -translate-x-1/2 -translate-y-1/2 bg-forest dark:bg-mint" />
        </div>
      </div>
      <h1 className="num mb-2.5 text-2xl text-ink sm:text-[26px] dark:text-dark-text">
        No events yet
      </h1>
      <p className="mb-6 max-w-[380px] text-[14px] leading-relaxed text-muted sm:text-[14.5px] dark:text-dark-muted">
        {canEdit
          ? "Create an event to start splitting bills with friends and family."
          : "Nothing here yet — check back once whoever shared this link creates the first event."}
      </p>
      {canEdit && (
        <button
          type="button"
          onClick={onCreate}
          className="rounded-md bg-forest px-6 py-3.5 text-sm font-bold text-cream shadow-[0_8px_20px_-6px_rgba(22,58,46,0.5)] hover:bg-forest-hover dark:bg-dark-forest"
        >
          + Create your first event
        </button>
      )}
    </div>
  );
}

// The right-hand figure's micro-label moves with settlementState so it can
// never contradict the value below it (previously always read "Unsettled"
// even once every bill was settled, or for an event with no bills at all).
const STATUS_COPY: Record<EventSummary["settlementState"], { label: string; value: string; className: string }> = {
  empty: { label: "Status", value: "No bills yet", className: "text-muted-2" },
  settled: { label: "Status", value: "All settled", className: "text-emerald dark:text-mint" },
  unsettled: { label: "Outstanding", value: "", className: "text-coral" },
};

function EventCard({
  groupId,
  event,
  canEdit,
  onRequestEdit,
  onRequestArchive,
}: {
  groupId: string;
  event: EventSummary;
  canEdit: boolean;
  onRequestEdit: (event: EventSummary) => void;
  onRequestArchive: (event: EventSummary) => void;
}) {
  const color = colorForSeed(event.id);
  const letter = event.name.trim().charAt(0).toUpperCase() || "?";
  const dateRange = formatDateRange(event.startDate, event.endDate);
  const status = STATUS_COPY[event.settlementState];
  const statusValue =
    event.settlementState === "unsettled"
      ? formatMoney(event.unsettledAmount, event.currency)
      : status.value;

  // EventCard only ever renders active events now -- archived events live
  // on the dedicated read-only screen (T3), reached via the "Archived
  // events" row below the grid. So there is no isArchived branch, no
  // Archived pill, and no Restore menu item here; Archive stays the only
  // status-changing action a card offers.

  // The menu is a sibling of the Link, not a child: <a> may not contain a
  // <button> under HTML's interactive content model, and nesting them would
  // also fire navigation on every menu click. The wrapper is relative so the
  // trigger can sit over the card's corner without joining its hit area.
  return (
    <div className="relative">
      <Link
        href={`/g/${groupId}/events/${event.id}`}
        className="block rounded-lg border border-ink/7 bg-white p-4 shadow-[0_16px_32px_-18px_rgba(19,46,40,0.18)] transition-shadow hover:shadow-[0_20px_40px_-16px_rgba(19,46,40,0.24)] sm:p-6 dark:border-white/7 dark:bg-dark-card"
      >
        {/* Member count sits under the name in the same column, instead of
            its own full-width line below the icon row -- that used to leave
            the icon's row height as dead space above it. */}
        <div className={cn("mb-3 flex items-center gap-2.5 sm:mb-4 sm:gap-3", canEdit && "pr-7")}>
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[13px] font-extrabold sm:h-[42px] sm:w-[42px] sm:text-[15px]"
            style={{ backgroundColor: `${color}1A`, color }}
          >
            {letter}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-ink sm:text-[17px] dark:text-dark-text">
              {event.name}
            </p>
            {/* Dates lead, same order and separator as the event dashboard's
                own meta line, so the card and the screen it opens agree.
                Dates are optional, so the member count carries the line
                alone when there are none. */}
            <p className="truncate text-[11px] text-muted sm:text-[13px] dark:text-dark-muted">
              {dateRange && `${dateRange} · `}
              {event.memberCount} member{event.memberCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
        <div className="mb-3 h-px bg-ink/8 sm:mb-4 dark:bg-white/10" />
        <div className="flex items-end justify-between">
          <div>
            <p className="mb-1 text-[11px] tracking-wide text-muted-2 uppercase sm:text-[11.5px]">
              Total spent
            </p>
            <p className="num text-[18px] text-ink sm:text-[22px] dark:text-dark-text">
              {formatMoney(event.totalSpend, event.currency)}
            </p>
          </div>
          <div className="text-right">
            <p className="mb-1 text-[11px] tracking-wide text-muted-2 uppercase sm:text-[11.5px]">
              {status.label}
            </p>
            <p className={`num text-[18px] sm:text-[22px] ${status.className}`}>{statusValue}</p>
          </div>
        </div>
      </Link>

      {canEdit && (
        <div className="absolute top-3 right-3 sm:top-5 sm:right-5">
          <MenuTrigger>
            <AriaButton
              aria-label={`Actions for ${event.name}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-2 outline-none hover:bg-ink/6 data-[pressed]:bg-ink/10 dark:hover:bg-white/8"
            >
              <MoreVertical className="h-4 w-4" aria-hidden="true" />
            </AriaButton>
            <Popover className="min-w-[172px] rounded-md border border-ink/10 bg-white p-1 shadow-[0_16px_32px_-14px_rgba(19,46,40,0.35)] dark:border-white/10 dark:bg-dark-card">
              <Menu
                className="outline-none"
                onAction={(key: Key) => {
                  if (key === "edit") onRequestEdit(event);
                  if (key === "archive") onRequestArchive(event);
                }}
              >
                <MenuItem
                  id="edit"
                  className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold text-ink outline-none data-[focused]:bg-ink/6 dark:text-dark-text dark:data-[focused]:bg-white/8"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Edit
                </MenuItem>
                <MenuItem
                  id="archive"
                  className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold text-ink outline-none data-[focused]:bg-ink/6 dark:text-dark-text dark:data-[focused]:bg-white/8"
                >
                  <Archive className="h-3.5 w-3.5" aria-hidden="true" /> Archive
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
      )}
    </div>
  );
}

// The combined cross-event position for one currency, shown above the event
// grid (two-up on desktop). Leads with the *final settlement* -- the fewest
// transfers that clear everyone across the covered events, the thing a user
// most wants -- and tucks the per-member owes/owed breakdown behind a toggle
// so two panels stay short enough to leave the events grid in view. Plain
// names, no "you" (rule 5); tabular-nums via .num; archived events excluded,
// and the micro-copy says so (rule 11).
function OverallPanel({
  groupId,
  canEdit,
  overview,
}: {
  groupId: string;
  canEdit: boolean;
  overview: GroupCurrencyOverview;
}) {
  const [showMembers, setShowMembers] = useState(false);

  // "· N events" scopes the claim to what's covered, never "every event"
  // (rule 11). One event -> settle that event; several -> cross-event settle.
  const settleSummary = `${overview.transfers.length} transfer${
    overview.transfers.length === 1 ? "" : "s"
  } to settle · ${overview.eventCount} event${overview.eventCount === 1 ? "" : "s"}`;
  const settleHref =
    overview.eventCount === 1
      ? `/g/${groupId}/events/${overview.eventIds[0]}/settle`
      : `/g/${groupId}/settle?currency=${overview.currency}`;

  return (
    <div className="rounded-lg border border-ink/7 bg-white p-4 shadow-[0_16px_32px_-18px_rgba(19,46,40,0.18)] sm:p-4.5 dark:border-white/7 dark:bg-dark-card">
      {/* Title + one-line settle summary stacked in the left column, on the
          same row as the action. Both truncate with an ellipsis when the card
          is narrow; the full text stays available on hover (title attr). */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate text-[14px] leading-tight font-bold text-ink sm:text-[15px] dark:text-dark-text"
            title={`Overall · ${overview.currency}`}
          >
            Overall <span className="font-normal text-muted-2">·</span> {overview.currency}
          </p>
          <p className="truncate text-[10.5px] text-muted-2" title={settleSummary}>
            {settleSummary}
          </p>
        </div>
        {canEdit && (
          <Link
            href={settleHref}
            className="shrink-0 rounded-md bg-forest px-3.5 py-2 text-[12px] font-bold whitespace-nowrap text-cream hover:bg-forest-hover dark:bg-dark-forest"
          >
            {overview.eventCount === 1 ? "Settle up" : "Settle all"}
          </Link>
        )}
      </div>

      {/* The final settlement -- the fewest transfers that clear everyone. */}
      <div className="divide-y divide-ink/8 border-t border-ink/8 dark:divide-white/8 dark:border-white/8">
        {overview.transfers.map((t) => (
          <div
            key={`${t.fromMemberId}-${t.toMemberId}`}
            className="flex items-center justify-between gap-2 py-1.5"
          >
            <p className="min-w-0 truncate text-[12px] text-ink dark:text-dark-text">
              <span className="font-bold">{t.fromName}</span>
              <span className="mx-1 text-muted-2">→</span>
              {t.toName}
            </p>
            <p className="num shrink-0 text-[12.5px] text-ink dark:text-dark-text">
              {formatMoney(t.amount, overview.currency)}
            </p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowMembers((v) => !v)}
        aria-expanded={showMembers}
        className="mt-3 flex items-center gap-1 text-[11px] font-bold text-muted-2 hover:text-ink dark:hover:text-dark-text"
      >
        <span className="text-[10px]">{showMembers ? "▾" : "▸"}</span>
        {showMembers ? "Hide member balances" : "Show member balances"}
      </button>

      {showMembers && (
        <div className="mt-1.5 divide-y divide-ink/6 border-t border-ink/6 dark:divide-white/6 dark:border-white/6">
          {overview.members.map((member) => (
            <div key={member.memberId} className="flex items-center justify-between gap-3 py-1.5">
              <p className="text-[12px] text-muted dark:text-dark-muted">{member.name}</p>
              <p
                className={cn(
                  "num text-[12.5px]",
                  member.net > 0 && "text-emerald dark:text-mint",
                  member.net < 0 && "text-coral",
                )}
              >
                {member.net > 0 ? "+" : "-"}
                {formatMoney(Math.abs(member.net), overview.currency)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

