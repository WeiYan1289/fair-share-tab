import { redirect } from "next/navigation";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { BillForm } from "@/components/bills/BillForm";

// Screen Spec P5-01/P5-02 (edit mode) / P5-03 (locked, settled bill).
export default async function EditBillPage({
  params,
}: {
  params: Promise<{ groupId: string; eventId: string; billId: string }>;
}) {
  const { groupId, eventId, billId } = await params;

  let session;
  try {
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const [event, bill] = await Promise.all([
    prisma.event.findUnique({
      where: { id: eventId },
      include: {
        eventMembers: {
          where: { member: { isActive: true } },
          include: { member: true },
          orderBy: { member: { createdAt: "asc" } },
        },
      },
    }),
    prisma.bill.findUnique({
      where: { id: billId },
      include: { splits: true, event: { select: { groupId: true } } },
    }),
  ]);

  if (!event || event.groupId !== groupId) redirect(`/g/${groupId}/events`);
  if (!bill || bill.eventId !== eventId || bill.event.groupId !== groupId) {
    redirect(`/g/${groupId}/events/${eventId}`);
  }

  // Active event members, plus anyone this bill already references (payer
  // or a split participant) even if they've since been deactivated -- a
  // past bill keeps its members (CLAUDE.md rule 4), so editing it shouldn't
  // silently drop them from the visible selection.
  const referencedIds = new Set([bill.payerId, ...bill.splits.map((s) => s.memberId)]);
  const activeIds = new Set(event.eventMembers.map((em) => em.memberId));
  const extraIds = [...referencedIds].filter((id) => !activeIds.has(id));

  const extraMembers = extraIds.length
    ? await prisma.member.findMany({ where: { id: { in: extraIds } } })
    : [];

  const members = [
    ...event.eventMembers.map(({ member }) => member),
    ...extraMembers,
  ].map((member) => ({
    id: member.id,
    name: member.name,
    avatarColor: member.avatarColor,
    isActive: member.isActive,
    createdAt: member.createdAt.toISOString(),
  }));

  return (
    <BillForm
      mode="edit"
      groupId={groupId}
      eventId={eventId}
      currency={event.currency}
      members={members}
      initialBill={{
        id: bill.id,
        title: bill.title,
        totalAmount: bill.totalAmount,
        payerId: bill.payerId,
        splitMethod: bill.splitMethod,
        status: bill.status,
        splits: bill.splits.map((s) => ({ memberId: s.memberId, shareAmount: s.shareAmount })),
      }}
    />
  );
}
