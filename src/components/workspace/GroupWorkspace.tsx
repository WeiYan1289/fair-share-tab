"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GroupHeader } from "@/components/group/GroupHeader";
import { ShareDialog } from "@/components/group/ShareDialog";
import { CreateEventModal } from "@/components/events/CreateEventModal";
import type { GroupCurrencyOverview } from "@/lib/expenses";
import { setGroupView, setCollapsedCookie } from "@/lib/view-cookie";
import { WorkspaceMemberList } from "./WorkspaceMemberList";
import { EventWorkspaceBlock, type WorkspaceEvent } from "./EventWorkspaceBlock";
import { WorkspaceSettleModal, type SettleModalEvent } from "./WorkspaceSettleModal";
import type { SettleMember } from "@/components/settle/SettleUpFlow";
import { Link as LinkIcon } from "lucide-react";

// The desktop group workspace shell (spec tiers 1-3): group header with create
// event / share / view toggle, the members' overall balances, then one
// collapsible block per active event. Owns per-event collapse state, persisted
// to a cookie so it survives reloads.
export function GroupWorkspace({
  groupId,
  groupName,
  viewerRole,
  actorType,
  overviews,
  events,
  initialCollapsed,
  saveLinkToken,
}: {
  groupId: string;
  groupName: string;
  viewerRole: "editor" | "viewer";
  actorType: "member" | "visitor";
  overviews: GroupCurrencyOverview[];
  events: WorkspaceEvent[];
  initialCollapsed: string[];
  /** One-time share-link token forwarded from the /g/{token} entry when a
   * desktop link-visitor is routed here instead of the classic list. Stripped
   * from the URL immediately so it never lingers in the address bar (rule 8). */
  saveLinkToken: string | null;
}) {
  const router = useRouter();
  const canEdit = viewerRole === "editor";
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(initialCollapsed));
  const [membersCollapsed, setMembersCollapsed] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showShare, setShowShare] = useState(false);

  // Strip the one-time share-link token from the URL as soon as we land here
  // (rule 8), exactly as the classic list does on its ?savelink landing.
  useEffect(() => {
    if (saveLinkToken !== null) {
      router.replace(`/g/${groupId}/workspace`);
    }
  }, [saveLinkToken, groupId, router]);

  // Total spent per member per currency, summed from the per-event shares
  // already loaded (all bills, active events only -- rule 11). Feeds the member
  // overview so each member shows what they spent alongside their net.
  const spentByCurrency = useMemo(() => {
    const acc: Record<string, Map<string, { name: string; spent: number }>> = {};
    for (const ev of events) {
      const inner = (acc[ev.currency] ??= new Map());
      for (const m of ev.members) {
        if (!m.inAnyBill) continue;
        const row = inner.get(m.id) ?? { name: m.name, spent: 0 };
        row.spent += m.share;
        inner.set(m.id, row);
      }
    }
    const out: Record<string, { memberId: string; name: string; spent: number }[]> = {};
    for (const [currency, inner] of Object.entries(acc)) {
      out[currency] = [...inner.entries()].map(([memberId, v]) => ({
        memberId,
        name: v.name,
        spent: v.spent,
      }));
    }
    return out;
  }, [events]);

  // Per-currency events with unsettled money, for the in-place settle modal.
  const settleEventsByCurrency = useMemo(() => {
    const acc: Record<string, SettleModalEvent[]> = {};
    for (const ev of events) {
      const unsettled = ev.bills.filter((b) => b.status === "unsettled");
      if (unsettled.length === 0) continue;
      (acc[ev.currency] ??= []).push({
        id: ev.id,
        name: ev.name,
        billIds: unsettled.map((b) => b.id),
        unsettledTotal: unsettled.reduce((s, b) => s + b.totalAmount, 0),
      });
    }
    return acc;
  }, [events]);

  const settleMembers = useMemo(() => {
    const map = new Map<string, SettleMember>();
    for (const ev of events)
      for (const m of ev.members)
        if (!map.has(m.id)) map.set(m.id, { id: m.id, name: m.name, avatarColor: m.avatarColor });
    return [...map.values()];
  }, [events]);

  const [settleCurrency, setSettleCurrency] = useState<string | null>(null);

  function toggleEvent(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setCollapsedCookie(next);
      return next;
    });
  }

  function switchToClassic() {
    setGroupView("classic");
    router.push(`/g/${groupId}/events`);
  }

  return (
    <div className="min-h-screen bg-cream px-5 py-6 sm:px-9 sm:py-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[1400px]">
        <GroupHeader groupId={groupId} groupName={groupName} actorType={actorType} />

        <div className="mb-6 flex flex-wrap items-center gap-2.5">
          {actorType === "member" && (
            <Link href="/account/groups" className="text-[13px] font-bold text-link dark:text-mint">
              ← All groups
            </Link>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {/* View toggle. One-page is the current view; Classic returns to the
                navigation-based events list and persists the choice. */}
            <div className="inline-flex overflow-hidden rounded-md border border-ink/16 dark:border-white/16">
              <button
                type="button"
                onClick={switchToClassic}
                className="px-3.5 py-2 text-[12.5px] font-bold text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text"
              >
                Classic
              </button>
              <span className="bg-forest px-3.5 py-2 text-[12.5px] font-bold text-cream dark:bg-dark-forest">
                One-page
              </span>
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowShare(true)}
                className="flex items-center gap-1.5 rounded-md border border-ink/14 bg-white px-4 py-2 text-[12.5px] font-bold text-ink dark:border-white/14 dark:bg-dark-card dark:text-dark-text"
              >
                <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" /> Share
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="rounded-md bg-forest px-4 py-2 text-[12.5px] font-bold text-cream hover:bg-forest-hover dark:bg-dark-forest"
              >
                + Create event
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4 sm:gap-5">
          <WorkspaceMemberList
            groupId={groupId}
            canEdit={canEdit}
            overviews={overviews}
            spentByCurrency={spentByCurrency}
            collapsed={membersCollapsed}
            onToggleCollapse={() => setMembersCollapsed((v) => !v)}
            onSettle={(currency) => setSettleCurrency(currency)}
          />

          {events.length === 0 ? (
            <div className="rounded-lg border border-ink/7 bg-white px-6 py-12 text-center dark:border-white/7 dark:bg-dark-card">
              <p className="mb-1.5 text-[15px] font-bold text-ink dark:text-dark-text">
                No events yet
              </p>
              <p className="text-[13px] text-muted dark:text-dark-muted">
                {canEdit
                  ? "Create an event to start splitting bills."
                  : "Nothing here yet — check back once an event is created."}
              </p>
            </div>
          ) : (
            events.map((event) => (
              <EventWorkspaceBlock
                key={event.id}
                groupId={groupId}
                event={event}
                canEdit={canEdit}
                collapsed={collapsed.has(event.id)}
                onToggleCollapse={() => toggleEvent(event.id)}
              />
            ))
          )}
        </div>
      </div>

      {showCreate && (
        <CreateEventModal
          groupId={groupId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
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
      {settleCurrency && settleEventsByCurrency[settleCurrency] && (
        <WorkspaceSettleModal
          groupId={groupId}
          currency={settleCurrency}
          events={settleEventsByCurrency[settleCurrency]}
          members={settleMembers}
          canConfirm={canEdit}
          onClose={() => setSettleCurrency(null)}
          onSettled={() => {
            setSettleCurrency(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
