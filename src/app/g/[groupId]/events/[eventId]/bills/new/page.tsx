import { redirect } from "next/navigation";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { BillForm } from "@/components/bills/BillForm";

// Screen Spec P5-01/P5-02 (create mode).
export default async function NewBillPage({
  params,
}: {
  params: Promise<{ groupId: string; eventId: string }>;
}) {
  const { groupId, eventId } = await params;

  let session;
  try {
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      eventMembers: {
        where: { member: { isActive: true } },
        include: { member: true },
        orderBy: { member: { createdAt: "asc" } },
      },
    },
  });
  if (!event || event.groupId !== groupId) redirect(`/g/${groupId}/events`);

  return (
    <BillForm
      mode="create"
      groupId={groupId}
      eventId={eventId}
      members={event.eventMembers.map(({ member }) => ({
        id: member.id,
        name: member.name,
        avatarColor: member.avatarColor,
        isActive: member.isActive,
        createdAt: member.createdAt.toISOString(),
      }))}
    />
  );
}
