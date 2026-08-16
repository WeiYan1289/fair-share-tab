import { redirect } from "next/navigation";
import { requireSession, SessionError, ArchivedGroupError } from "@/lib/auth/require-session";
import { listGroupEvents } from "@/lib/events";
import { getGroupCombinedBalances } from "@/lib/expenses";
import { listGroupMembers } from "@/lib/members";
import { prisma } from "@/lib/prisma";
import { EventsListView } from "@/components/events/EventsListView";

// Screen Spec P3-02/P3-03. Server Component: reads the session set at
// /g/[groupId] and loads data directly via Prisma (CLAUDE.md rule 7 — all
// DB access goes through server code).
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

  const [events, members, combined] = await Promise.all([
    listGroupEvents(groupId),
    listGroupMembers(groupId),
    getGroupCombinedBalances(groupId),
  ]);

  return (
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
      combined={combined}
    />
  );
}
