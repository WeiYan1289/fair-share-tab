import { redirect } from "next/navigation";
import { requireSession, SessionError, ArchivedGroupError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { BillForm } from "@/components/bills/BillForm";

// Screen Spec P5-01/P5-02 (edit mode) / P5-03 (locked, settled bill).
export default async function EditBillPage({
  params,
}: {
  params: Promise<{ groupId: string; eventId: string; billId: string }>;
}) {
  const { groupId, eventId, billId } = await params;

  // Any role may land here. Two independent reasons make a bill read-only:
  // it's settled (immutable at the API layer regardless of role -- rule
  // 10), or the viewer isn't an editor. Neither reason blocks viewing --
  // only editing -- so both render the same read-only detail rather than
  // redirecting away.
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof ArchivedGroupError) redirect("/group-archived");
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

  // Read-only whenever either condition holds. PATCH /api/bills/{id}
  // enforces the same two rules independently (settled rejected outright;
  // role checked via requireSession({ role: "editor" })), so this is what
  // decides which UI to render, not the only thing standing between a
  // viewer and a write.
  const viewOnly = bill.status === "settled" || session.role !== "editor";

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
      viewOnly={viewOnly}
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
        receiptUrl: bill.receiptUrl,
        splits: bill.splits.map((s) => ({ memberId: s.memberId, shareAmount: s.shareAmount })),
      }}
    />
  );
}
