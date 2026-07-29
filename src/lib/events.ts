import { prisma } from "@/lib/prisma";
import { computeNetBalances } from "@/lib/settlement";

// Shared by the events API route and the events-list Server Component
// (system-design.md §5 "Events") so the total-spend / unsettled-amount
// computation only lives in one place.
export async function listGroupEvents(groupId: string) {
  const events = await prisma.event.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { eventMembers: true } },
      bills: { select: { totalAmount: true, status: true } },
    },
  });

  return events.map((event) => {
    const unsettledAmount = event.bills
      .filter((bill) => bill.status === "unsettled")
      .reduce((sum, bill) => sum + bill.totalAmount, 0);

    // Drives the event card's status label (Screen Spec P3-02): an event
    // with no bills yet is not "settled", it just hasn't started, and the
    // label text must move with this state so it can never read
    // "Unsettled" above a value of "Settled".
    const settlementState: "empty" | "settled" | "unsettled" =
      event.bills.length === 0 ? "empty" : unsettledAmount === 0 ? "settled" : "unsettled";

    return {
      id: event.id,
      name: event.name,
      currency: event.currency,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
      memberCount: event._count.eventMembers,
      totalSpend: event.bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      unsettledAmount,
      settlementState,
    };
  });
}

// Shared by the event-detail API route and the event-dashboard Server
// Component (Screen Spec P4-01) so the balance computation only lives in
// one place. Balances net over unsettled bills only -- a settled bill's
// debts are already resolved via its transfers.
export async function getEventDetail(eventId: string, groupId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      eventMembers: { include: { member: true }, orderBy: { member: { createdAt: "asc" } } },
      bills: { include: { splits: true, payer: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!event || event.groupId !== groupId) return null;

  const unsettledBills = event.bills.filter((bill) => bill.status === "unsettled");
  const balances = computeNetBalances(
    unsettledBills.map((bill) => ({
      payerId: bill.payerId,
      totalAmount: bill.totalAmount,
      splits: bill.splits.map((split) => ({
        memberId: split.memberId,
        shareAmount: split.shareAmount,
      })),
    })),
  );

  return {
    id: event.id,
    groupId: event.groupId,
    name: event.name,
    currency: event.currency,
    startDate: event.startDate,
    endDate: event.endDate,
    status: event.status,
    totalSpend: event.bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
    members: event.eventMembers.map(({ member }) => ({
      id: member.id,
      name: member.name,
      avatarColor: member.avatarColor,
      isActive: member.isActive,
      createdAt: member.createdAt,
      balance: balances.get(member.id) ?? 0,
    })),
    bills: event.bills.map((bill) => ({
      id: bill.id,
      title: bill.title,
      payerId: bill.payerId,
      payerName: bill.payer.name,
      splitCount: bill.splits.length,
      totalAmount: bill.totalAmount,
      status: bill.status,
    })),
  };
}
