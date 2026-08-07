import { redirect } from "next/navigation";
import { requireSession, SessionError, ArchivedGroupError } from "@/lib/auth/require-session";
import { listArchivedGroupEvents } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { formatShortDate } from "@/lib/format";
import { ArchivedEventsView } from "@/components/events/ArchivedEventsView";

// Screen Spec addendum (archived-readonly T3): the option-B entry point on
// the active events list links here. Same session/redirect idiom as the
// sibling events/page.tsx, including catching ArchivedGroupError before
// SessionError -- an archived *group* still needs its own redirect even
// though this page is about archived *events*.
export default async function ArchivedEventsPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

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

  const events = await listArchivedGroupEvents(groupId);

  return (
    <ArchivedEventsView
      groupId={groupId}
      groupName={group.name}
      actorType={session.actorType}
      viewerRole={session.role}
      events={events.map((event) => ({
        id: event.id,
        name: event.name,
        currency: event.currency,
        totalSpend: event.totalSpend,
        billCount: event.billCount,
        memberCount: event.memberCount,
        unsettledAmount: event.unsettledAmount,
        // Formatted here, server-side, exactly once -- see the equivalent
        // comment in account/groups/archived/page.tsx for why a raw ISO
        // timestamp can't be handed to the client component to format.
        archivedAtLabel: event.archivedAt ? formatShortDate(event.archivedAt) : null,
      }))}
    />
  );
}
