import { redirect } from "next/navigation";
import { requireSession, SessionError, ArchivedGroupError } from "@/lib/auth/require-session";
import { listGroupEvents } from "@/lib/events";
import { getGroupCurrencyOverviews } from "@/lib/expenses";
import { listGroupMembers } from "@/lib/members";
import { prisma } from "@/lib/prisma";
import { EventsListView } from "@/components/events/EventsListView";

// Screen Spec P3-02/P3-03. Server Component: reads the session set at
// /g/[groupId] and loads data directly via Prisma (CLAUDE.md rule 7 — all
// DB access goes through server code).
// Runs before the classic list paints: a desktop visitor whose stored view
// preference isn't "classic" (workspace is the desktop default) is sent
// straight to the one-page workspace, so there's no classic-then-redirect
// flash. The current query string is carried across, so a ?savelink share-link
// landing continues on the workspace (which strips the token there, rule 8).
// Skipped on mobile (viewport gate) -- a mobile link-visitor stays on the
// classic list exactly as before.
const WORKSPACE_REDIRECT_SCRIPT =
  "(function(){try{var m=document.cookie.match(/(?:^|; )fst_group_view=([^;]*)/);var p=m?m[1]:null;if(p==='classic')return;if(!matchMedia('(min-width:1024px)').matches)return;var pn=location.pathname;if(pn.charAt(pn.length-1)==='/')pn=pn.slice(0,-1);if(pn.slice(-7)==='/events'){location.replace(pn.slice(0,-7)+'/workspace'+location.search);}}catch(e){}})();";

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ savelink?: string }>;
}) {
  const { groupId } = await params;
  const { savelink } = await searchParams;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof ArchivedGroupError) redirect("/group-archived");
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
  if (!group) redirect("/");

  const [events, members, overviews] = await Promise.all([
    listGroupEvents(groupId),
    listGroupMembers(groupId),
    getGroupCurrencyOverviews(groupId),
  ]);

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: WORKSPACE_REDIRECT_SCRIPT }} />
      <EventsListView
        groupId={groupId}
      groupName={group.name}
      viewerRole={session.role}
      actorType={session.actorType}
      saveLinkToken={savelink ?? null}
      events={events.map((event) => ({
        id: event.id,
        name: event.name,
        currency: event.currency,
        // Sliced, not toISOString()-then-parsed on the client: these are
        // date-only values stored at UTC midnight, and re-deriving them
        // through a local Date would shift the day west of UTC.
        startDate: event.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: event.endDate?.toISOString().slice(0, 10) ?? null,
        status: event.status,
        memberCount: event.memberCount,
        totalSpend: event.totalSpend,
        unsettledAmount: event.unsettledAmount,
        unsettledCount: event.unsettledCount,
        settlementState: event.settlementState,
      }))}
      members={members}
      overviews={overviews}
      />
    </>
  );
}
