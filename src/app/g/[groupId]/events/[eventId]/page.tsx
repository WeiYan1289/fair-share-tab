import { redirect } from "next/navigation";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { getEventDetail } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { EventDashboard } from "@/components/events/EventDashboard";

// Screen Spec P4-01/P4-02/P4-03. Server Component: reads the session and
// loads data directly via Prisma (CLAUDE.md rule 7).
export default async function EventDashboardPage({
  params,
}: {
  params: Promise<{ groupId: string; eventId: string }>;
}) {
  const { groupId, eventId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const [group, event] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    getEventDetail(eventId, groupId),
  ]);
  if (!group) redirect("/");
  if (!event) redirect(`/g/${groupId}/events`);

  return (
    <EventDashboard
      groupId={groupId}
      groupName={group.name}
      viewerRole={session.role}
      actorType={session.actorType}
      event={{
        ...event,
        startDate: event.startDate?.toISOString() ?? null,
        endDate: event.endDate?.toISOString() ?? null,
        members: event.members.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
      }}
    />
  );
}
