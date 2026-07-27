"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GroupHeader } from "@/components/group/GroupHeader";
import { colorForSeed } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { CreateEventModal } from "./CreateEventModal";

interface EventSummary {
  id: string;
  name: string;
  currency: string;
  memberCount: number;
  totalSpend: number;
  unsettledAmount: number;
}

interface EventsListViewProps {
  groupId: string;
  groupName: string;
  viewerRole: "editor" | "viewer";
  actorType: "member" | "visitor";
  saveLinkToken: string | null;
  events: EventSummary[];
}

// Screen Spec P3-02 (populated) / P3-03 (empty state).
export function EventsListView({
  groupId,
  groupName,
  viewerRole,
  actorType,
  saveLinkToken,
  events,
}: EventsListViewProps) {
  const router = useRouter();
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showSaveLinkBanner, setShowSaveLinkBanner] = useState(saveLinkToken !== null);
  // Captured once on mount: `router.replace` below causes the server to
  // re-render this page with `saveLinkToken` as null (the query param is
  // gone), so the live prop can't be used for the banner's contents — it
  // would disappear on its own the instant the URL strip lands, instead of
  // staying up until the user dismisses it.
  const [savedToken] = useState(saveLinkToken);
  const canEdit = viewerRole === "editor";

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

        {showSaveLinkBanner && savedToken && (
          <SaveLinkBanner token={savedToken} onDismiss={() => setShowSaveLinkBanner(false)} />
        )}

        {events.length === 0 ? (
          <EmptyState canEdit={canEdit} onCreate={() => setShowCreateEvent(true)} />
        ) : (
          <>
            <div className="mb-6 flex items-end justify-between sm:mb-[30px]">
              <div>
                <h1 className="num text-[28px] text-ink sm:text-[34px] dark:text-dark-text">
                  Your events
                </h1>
                <p className="mt-1.5 text-[13px] text-muted sm:text-[13.5px] dark:text-dark-muted">
                  {events.length} event{events.length === 1 ? "" : "s"}
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
              {events.map((event) => (
                <EventCard key={event.id} groupId={groupId} event={event} />
              ))}
            </div>
          </>
        )}
      </div>

      {canEdit && events.length > 0 && (
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

function EventCard({ groupId, event }: { groupId: string; event: EventSummary }) {
  const color = colorForSeed(event.id);
  const letter = event.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link
      href={`/g/${groupId}/events/${event.id}`}
      className="block rounded-lg border border-ink/7 bg-white p-5 shadow-[0_16px_32px_-18px_rgba(19,46,40,0.18)] transition-shadow hover:shadow-[0_20px_40px_-16px_rgba(19,46,40,0.24)] sm:p-6 dark:border-white/7 dark:bg-dark-card"
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-md text-[15px] font-extrabold"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          {letter}
        </div>
        <div className="text-[17px] font-bold text-ink dark:text-dark-text">{event.name}</div>
      </div>
      <p className="mb-4 text-[13px] text-muted dark:text-dark-muted">
        {event.memberCount} member{event.memberCount === 1 ? "" : "s"}
      </p>
      <div className="mb-4 h-px bg-ink/8 dark:bg-white/10" />
      <div className="flex items-end justify-between">
        <div>
          <p className="mb-1 text-[11.5px] tracking-wide text-muted-2 uppercase">Total spent</p>
          <p className="num text-[20px] text-ink sm:text-[22px] dark:text-dark-text">
            {formatMoney(event.totalSpend, event.currency)}
          </p>
        </div>
        <div className="text-right">
          <p className="mb-1 text-[11.5px] tracking-wide text-muted-2 uppercase">Unsettled</p>
          <p
            className={`num text-[20px] sm:text-[22px] ${
              event.unsettledAmount > 0 ? "text-coral" : "text-emerald dark:text-mint"
            }`}
          >
            {event.unsettledAmount > 0
              ? formatMoney(event.unsettledAmount, event.currency)
              : "Settled"}
          </p>
        </div>
      </div>
    </Link>
  );
}

function SaveLinkBanner({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function handleCopy() {
    const link = `${window.location.origin}/g/${token}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopyError(false);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Insecure context or permission denial — nothing we can do about
      // the copy itself, so surface it instead of failing silently.
      setCopied(false);
      setCopyError(true);
      setTimeout(() => setCopyError(false), 2000);
    }
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-md border border-ink/10 bg-mint-tint px-4.5 py-3 dark:border-white/10 dark:bg-mint/16">
      <p className="text-[12.5px] leading-snug text-emerald dark:text-mint">
        {copyError
          ? "Couldn't copy — select and copy the link from your address bar instead."
          : "Save this link to get back in — there's no account, so this is the only way back."}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md bg-forest px-3.5 py-2 text-[12.5px] font-bold whitespace-nowrap text-cream dark:bg-dark-forest"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-[13px] text-muted-2"
        >
          ×
        </button>
      </div>
    </div>
  );
}
