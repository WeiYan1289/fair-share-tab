import { DEFAULT_CURRENCY } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import {
  computeMemberEventBalance,
  computeMemberEventExpense,
  type MemberBillLine,
  type MemberEventBalanceTransfer,
} from "./aggregate";

export interface MemberExpenseBillLine extends MemberBillLine {
  payerName: string;
}

export interface MemberExpenseEvent {
  id: string;
  name: string;
  currency: string;
  startDate: Date | null;
  endDate: Date | null;
  share: number;
  paid: number;
  lines: MemberExpenseBillLine[];
}

export interface MemberExpenses {
  member: { id: string; name: string; avatarColor: string; isActive: boolean };
  /** Currency codes this member has spend in, MYR-first. */
  currencies: string[];
  events: MemberExpenseEvent[];
  /**
   * True when this member has any involvement (as participant, payer, or
   * split) in an archived event -- those events' bills are excluded from
   * `events`/`currencies` above (spec 2026-08-06 feature B), so the UI can
   * caveat "every event" copy instead of asserting something false.
   */
  hasArchivedEvents: boolean;
}

async function loadMember(memberId: string, groupId: string) {
  const member = await prisma.member.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, avatarColor: true, isActive: true, groupId: true },
  });
  if (!member || member.groupId !== groupId) return null;
  return member;
}

/**
 * Spend history for one member across every active event they're connected to in
 * this group -- including events they've since left (a member can pay for
 * or be split on a bill in an event they're no longer part of) and events
 * that are fully settled (this is spend history, not outstanding debt; see
 * computeMemberEventExpense). Grouped by currency, never converted or
 * summed across currencies (CLAUDE.md rule 1) -- an event picks its own
 * currency, so "total spend" only means something within one currency.
 * Archived events are excluded from member math (spec 2026-08-06 feature B).
 */
export async function getMemberExpenses(memberId: string, groupId: string): Promise<MemberExpenses | null> {
  const member = await loadMember(memberId, groupId);
  if (!member) return null;

  const events = await prisma.event.findMany({
    where: {
      groupId,
      status: "active",
      OR: [
        { eventMembers: { some: { memberId } } },
        { bills: { some: { payerId: memberId } } },
        { bills: { some: { splits: { some: { memberId } } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      bills: { include: { splits: true, payer: { select: { name: true } } } },
    },
  });

  const currencySet = new Set<string>();
  const eventResults: MemberExpenseEvent[] = [];

  for (const event of events) {
    const expense = computeMemberEventExpense(
      memberId,
      event.bills.map((bill) => ({
        billId: bill.id,
        title: bill.title,
        totalAmount: bill.totalAmount,
        payerId: bill.payerId,
        createdAt: bill.createdAt,
        splits: bill.splits.map((split) => ({ memberId: split.memberId, shareAmount: split.shareAmount })),
      })),
    );
    if (expense.lines.length === 0) continue;

    currencySet.add(event.currency);
    const payerNameByBillId = new Map(event.bills.map((b) => [b.id, b.payer.name]));

    eventResults.push({
      id: event.id,
      name: event.name,
      currency: event.currency,
      startDate: event.startDate,
      endDate: event.endDate,
      share: expense.share,
      paid: expense.paid,
      lines: expense.lines.map((line) => ({
        ...line,
        payerName: payerNameByBillId.get(line.billId) ?? "",
      })),
    });
  }

  const currencies = [...currencySet].sort((a, b) => {
    if (a === DEFAULT_CURRENCY) return -1;
    if (b === DEFAULT_CURRENCY) return 1;
    return a.localeCompare(b);
  });

  const archivedCount = await prisma.event.count({
    where: {
      groupId,
      status: "archived",
      OR: [
        { eventMembers: { some: { memberId } } },
        { bills: { some: { payerId: memberId } } },
        { bills: { some: { splits: { some: { memberId } } } } },
      ],
    },
  });

  return { member, currencies, events: eventResults, hasArchivedEvents: archivedCount > 0 };
}

export interface MemberBalanceTransfer {
  otherMemberId: string;
  otherName: string;
  direction: "pays" | "receives";
  amount: number;
}

export interface MemberBalanceEvent {
  id: string;
  name: string;
  currency: string;
  net: number;
  transfers: MemberBalanceTransfer[];
}

export interface MemberBalance {
  events: MemberBalanceEvent[];
  /** See MemberExpenses.hasArchivedEvents -- same caveat, for the balance tab. */
  hasArchivedEvents: boolean;
}

/**
 * What's still outstanding for one member, event by event -- nets over
 * unsettled bills only (mirrors getEventDetail) and simplifies to the
 * transfers that would settle it, filtered to the ones touching this
 * member. Reuses the settlement engine directly rather than recomputing
 * debt logic here; a settled event is omitted entirely, not shown at zero.
 * Archived events are excluded from member math (spec 2026-08-06 feature B).
 */
export async function getMemberBalance(memberId: string, groupId: string): Promise<MemberBalance | null> {
  const member = await loadMember(memberId, groupId);
  if (!member) return null;

  const events = await prisma.event.findMany({
    where: { groupId, status: "active", eventMembers: { some: { memberId } } },
    orderBy: { createdAt: "desc" },
    include: {
      bills: { where: { status: "unsettled" }, include: { splits: true } },
      eventMembers: { include: { member: { select: { id: true, name: true } } } },
    },
  });

  const results: MemberBalanceEvent[] = [];

  for (const event of events) {
    if (event.bills.length === 0) continue;

    const { net, transfers } = computeMemberEventBalance(
      memberId,
      event.bills.map((bill) => ({
        payerId: bill.payerId,
        totalAmount: bill.totalAmount,
        splits: bill.splits.map((split) => ({ memberId: split.memberId, shareAmount: split.shareAmount })),
      })),
    );
    if (net === 0) continue;

    const nameById = new Map(event.eventMembers.map(({ member: m }) => [m.id, m.name]));
    const namedTransfers: MemberBalanceTransfer[] = transfers.map((t) => ({
      ...t,
      otherName: nameById.get(t.otherMemberId) ?? "",
    }));

    results.push({ id: event.id, name: event.name, currency: event.currency, net, transfers: namedTransfers });
  }

  const archivedCount = await prisma.event.count({
    where: { groupId, status: "archived", eventMembers: { some: { memberId } } },
  });

  return { events: results, hasArchivedEvents: archivedCount > 0 };
}

export interface MemberEventActivity {
  member: { id: string; name: string; avatarColor: string; isActive: boolean };
  event: { id: string; name: string; currency: string };
  share: number;
  paid: number;
  net: number;
  lines: MemberExpenseBillLine[];
  transfers: (MemberEventBalanceTransfer & { otherName: string })[];
}

/**
 * Everything about one member's involvement in exactly one event -- their
 * bills, their share/paid totals (all bills, settled and unsettled, same
 * spend-history semantics as computeMemberEventExpense), and their net
 * balance and settlement transfers for this event only (unsettled bills
 * only, same as getMemberBalance). This is the destination for the event
 * dashboard's member chip, deliberately scoped to one event so it never
 * shows anything from the member's other trips -- that's what
 * getMemberExpenses/getMemberBalance are for. Unlike those cross-event
 * functions, this is not filtered by event status; it is reached from
 * inside the event's own dashboard, so archived events remain navigable.
 */
export async function getMemberEventActivity(
  memberId: string,
  eventId: string,
  groupId: string,
): Promise<MemberEventActivity | null> {
  const member = await loadMember(memberId, groupId);
  if (!member) return null;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      bills: { include: { splits: true, payer: { select: { name: true } } } },
      eventMembers: { include: { member: { select: { id: true, name: true } } } },
    },
  });
  if (!event || event.groupId !== groupId) return null;

  const toExpenseBill = (bill: (typeof event.bills)[number]) => ({
    billId: bill.id,
    title: bill.title,
    totalAmount: bill.totalAmount,
    payerId: bill.payerId,
    createdAt: bill.createdAt,
    splits: bill.splits.map((s) => ({ memberId: s.memberId, shareAmount: s.shareAmount })),
  });

  const expense = computeMemberEventExpense(memberId, event.bills.map(toExpenseBill));
  const payerNameByBillId = new Map(event.bills.map((b) => [b.id, b.payer.name]));

  const unsettledBills = event.bills.filter((b) => b.status === "unsettled").map(toExpenseBill);
  const { net, transfers } = computeMemberEventBalance(memberId, unsettledBills);
  const nameById = new Map(event.eventMembers.map(({ member: m }) => [m.id, m.name]));

  return {
    member,
    event: { id: event.id, name: event.name, currency: event.currency },
    share: expense.share,
    paid: expense.paid,
    net,
    lines: expense.lines.map((line) => ({ ...line, payerName: payerNameByBillId.get(line.billId) ?? "" })),
    transfers: transfers.map((t) => ({ ...t, otherName: nameById.get(t.otherMemberId) ?? "" })),
  };
}
