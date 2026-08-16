import { redirect } from "next/navigation";
import { requireSession, SessionError, ArchivedGroupError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { CrossEventSettleFlow } from "@/components/settle/CrossEventSettleFlow";

// Cross-event settle flow (cross-event settlement design, "Cross-event settle
// flow"). Pre-scoped to one currency via ?currency= from the Overall panel.
// Preview is readable by any session; the confirm endpoint is editor-only
// (CLAUDE.md rule 9), and the client hides "Mark as settled" for viewers.
export default async function CrossEventSettlePage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ currency?: string }>;
}) {
  const { groupId } = await params;
  const { currency } = await searchParams;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof ArchivedGroupError) redirect("/group-archived");
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");
  if (!currency) redirect(`/g/${groupId}/events`);

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
  if (!group) redirect("/");

  // Active events in this currency that carry unsettled money. Two or more is
  // the gate (spec): with fewer, the per-event flow already covers it.
  const events = await prisma.event.findMany({
    where: { groupId, status: "active", currency },
    orderBy: { createdAt: "desc" },
    include: {
      bills: { where: { status: "unsettled" }, select: { id: true, totalAmount: true } },
      eventMembers: { include: { member: { select: { id: true, name: true, avatarColor: true } } } },
    },
  });

  const withMoney = events.filter((e) => e.bills.length > 0);
  if (withMoney.length < 2) redirect(`/g/${groupId}/events`);

  // Union of members across the included events -- enough for TransferGraph to
  // resolve every id that appears in a transfer.
  const memberById = new Map<string, { id: string; name: string; avatarColor: string }>();
  for (const event of withMoney) {
    for (const { member } of event.eventMembers) {
      memberById.set(member.id, { id: member.id, name: member.name, avatarColor: member.avatarColor });
    }
  }

  return (
    <CrossEventSettleFlow
      groupId={groupId}
      groupName={group.name}
      currency={currency}
      viewerRole={session.role}
      actorType={session.actorType}
      members={[...memberById.values()]}
      events={withMoney.map((event) => ({
        id: event.id,
        name: event.name,
        billIds: event.bills.map((b) => b.id),
        unsettledTotal: event.bills.reduce((sum, b) => sum + b.totalAmount, 0),
        unsettledCount: event.bills.length,
      }))}
    />
  );
}
