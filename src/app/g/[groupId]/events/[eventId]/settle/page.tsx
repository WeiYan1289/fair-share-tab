import { redirect } from "next/navigation";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { SettleUpFlow } from "@/components/settle/SettleUpFlow";

// Screen Spec P6-01/P6-02/P6-03/P6-04. Preview is readable by any session;
// the client component hides "Mark as settled" for viewer-role sessions
// (the confirm endpoint itself is editor-only either way -- CLAUDE.md rule 9).
export default async function SettleUpPage({
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

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      eventMembers: { include: { member: true } },
      bills: {
        where: { status: "unsettled" },
        include: { splits: true, payer: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!event || event.groupId !== groupId) redirect(`/g/${groupId}/events`);

  return (
    <SettleUpFlow
      groupId={groupId}
      eventId={eventId}
      eventName={event.name}
      viewerRole={session.role}
      members={event.eventMembers.map(({ member }) => ({
        id: member.id,
        name: member.name,
        avatarColor: member.avatarColor,
      }))}
      bills={event.bills.map((bill) => ({
        id: bill.id,
        title: bill.title,
        payerName: bill.payer.name,
        splitCount: bill.splits.length,
        totalAmount: bill.totalAmount,
      }))}
    />
  );
}
