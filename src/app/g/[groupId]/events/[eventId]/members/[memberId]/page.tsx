import { redirect } from "next/navigation";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { getMemberEventActivity } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { MemberEventActivityView } from "@/components/members/MemberEventActivityView";

// Screen Spec companion to P4-01 (event dashboard): the member chip's
// "View activity" destination, scoped to exactly this event. requireSession()
// with no role requirement -- viewers see this too, same as every other
// member-detail screen.
export default async function MemberEventActivityPage({
  params,
}: {
  params: Promise<{ groupId: string; eventId: string; memberId: string }>;
}) {
  const { groupId, eventId, memberId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const [group, activity] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    getMemberEventActivity(memberId, eventId, groupId),
  ]);
  if (!group) redirect("/");
  if (!activity) redirect(`/g/${groupId}/events/${eventId}`);

  return (
    <MemberEventActivityView
      groupId={groupId}
      groupName={group.name}
      actorType={session.actorType}
      member={activity.member}
      event={activity.event}
      share={activity.share}
      paid={activity.paid}
      net={activity.net}
      lines={activity.lines.map((line) => ({ ...line, createdAt: line.createdAt.toISOString() }))}
      transfers={activity.transfers}
    />
  );
}
