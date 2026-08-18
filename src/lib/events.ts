import { prisma } from "@/lib/prisma";
import { collectBillParticipants, selectBillParticipants } from "@/lib/bill-participants";
import { computeNetBalances } from "@/lib/settlement";
import type { UpdateEventInput } from "@/lib/validation/event";

// Thrown by assertEventNotArchived; every write route against an event (or
// a bill scoped to one) catches this the same way it catches SessionError/
// CsrfError -- instanceof check, then `NextResponse.json({ error:
// error.message }, { status: error.status })`.
export class ArchivedEventError extends Error {
  status = 409 as const;

  constructor(message: string) {
    super(message);
  }
}

// Archived means sealed (CLAUDE.md rule 4): every write on an archived
// event must 409, with one exception -- the events PATCH route that
// restores status to "active". That route does NOT call this helper when
// the request is restore-only; every other write route (bills, event
// members, event rename/dates, settlement preview/confirm) calls this
// unconditionally against the event row it already loaded, so the check
// lives in exactly one place and can't drift between routes.
export function assertEventNotArchived(event: { status: string }, message: string): void {
  if (event.status === "archived") {
    throw new ArchivedEventError(message);
  }
}

// The events PATCH route's one exception to assertEventNotArchived: a
// payload that ONLY restores status to "active" (nothing else) is let
// through against an archived event. Extracted as a named predicate --
// rather than left inline in the route -- specifically so it has direct
// Vitest coverage (CLAUDE.md's "small decision predicate" test category):
// this is a pure function of updateEventSchema's shape, and if a field is
// ever added to that schema without being added here, the seal silently
// reopens for that field whenever it rides along with status:"active" on
// an archived event.
export function isRestoreOnlyEventPatch(data: UpdateEventInput): boolean {
  return (
    data.status === "active" &&
    data.name === undefined &&
    data.startDate === undefined &&
    data.endDate === undefined &&
    data.currency === undefined
  );
}

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
    const unsettledBills = event.bills.filter((bill) => bill.status === "unsettled");
    const unsettledAmount = unsettledBills.reduce((sum, bill) => sum + bill.totalAmount, 0);
    const unsettledCount = unsettledBills.length;

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
      unsettledCount,
      settlementState,
    };
  });
}

// Backs the archived-events screen (T3): a ruled list, not the card grid,
// so it only needs the fields that list actually renders -- no
// settlementState, since an archived event's status can't move without
// restoring it first. Ordered by archivedAt desc, nulls last (rows
// archived before T0 added the column), then createdAt desc so those
// undated rows still have a stable, recency-ish order.
export async function listArchivedGroupEvents(groupId: string) {
  const events = await prisma.event.findMany({
    where: { groupId, status: "archived" },
    orderBy: [{ archivedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    include: {
      _count: { select: { eventMembers: true } },
      bills: { select: { totalAmount: true, status: true } },
    },
  });

  return events.map((event) => {
    const unsettledAmount = event.bills
      .filter((bill) => bill.status === "unsettled")
      .reduce((sum, bill) => sum + bill.totalAmount, 0);

    return {
      id: event.id,
      name: event.name,
      currency: event.currency,
      totalSpend: event.bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      billCount: event.bills.length,
      memberCount: event._count.eventMembers,
      unsettledAmount,
      archivedAt: event.archivedAt,
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

  // Over ALL bills, not just unsettled ones: this answers "did they take
  // part at all", which is what separates a member who is square from a
  // member who was never in a bill. Both net to zero.
  const participants = collectBillParticipants(event.bills);

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

  // Per-member spend across ALL bills (settled + unsettled): `share` is what
  // their portions total, `paid` is what they fronted. Feeds the desktop
  // workspace's per-member spent breakdown.
  const shareByMember = new Map<string, number>();
  const paidByMember = new Map<string, number>();
  for (const bill of event.bills) {
    paidByMember.set(bill.payerId, (paidByMember.get(bill.payerId) ?? 0) + bill.totalAmount);
    for (const split of bill.splits) {
      shareByMember.set(split.memberId, (shareByMember.get(split.memberId) ?? 0) + split.shareAmount);
    }
  }

  const orderedMembers = event.eventMembers.map(({ member }) => ({
    id: member.id,
    name: member.name,
    avatarColor: member.avatarColor,
  }));

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
      share: shareByMember.get(member.id) ?? 0,
      paid: paidByMember.get(member.id) ?? 0,
      inAnyBill: participants.has(member.id),
    })),
    bills: event.bills.map((bill) => ({
      id: bill.id,
      title: bill.title,
      payerId: bill.payerId,
      payerName: bill.payer.name,
      participants: selectBillParticipants(bill.splits, orderedMembers),
      totalAmount: bill.totalAmount,
      status: bill.status,
    })),
  };
}
