import { prisma } from "@/lib/prisma";

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

  return events.map((event) => ({
    id: event.id,
    name: event.name,
    startDate: event.startDate,
    endDate: event.endDate,
    status: event.status,
    memberCount: event._count.eventMembers,
    totalSpend: event.bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
    unsettledAmount: event.bills
      .filter((bill) => bill.status === "unsettled")
      .reduce((sum, bill) => sum + bill.totalAmount, 0),
  }));
}
