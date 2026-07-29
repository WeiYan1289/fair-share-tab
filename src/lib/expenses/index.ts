import { DEFAULT_CURRENCY } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { computeNetBalances, simplifyDebts } from "@/lib/settlement";
import { computeMemberEventExpense, type MemberBillLine } from "./aggregate";

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
 * Spend history for one member across every event they're connected to in
 * this group -- including events they've since left (a member can pay for
 * or be split on a bill in an event they're no longer part of) and events
 * that are fully settled (this is spend history, not outstanding debt; see
 * computeMemberEventExpense). Grouped by currency, never converted or
 * summed across currencies (CLAUDE.md rule 1) -- an event picks its own
 * currency, so "total spend" only means something within one currency.
 */
export async function getMemberExpenses(memberId: string, groupId: string): Promise<MemberExpenses | null> {
  const member = await loadMember(memberId, groupId);
  if (!member) return null;

  const events = await prisma.event.findMany({
    where: {
      groupId,
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

  return { member, currencies, events: eventResults };
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
}

/**
 * What's still outstanding for one member, event by event -- nets over
 * unsettled bills only (mirrors getEventDetail) and simplifies to the
 * transfers that would settle it, filtered to the ones touching this
 * member. Reuses the settlement engine directly rather than recomputing
 * debt logic here; a settled event is omitted entirely, not shown at zero.
 */
export async function getMemberBalance(memberId: string, groupId: string): Promise<MemberBalance | null> {
  const member = await loadMember(memberId, groupId);
  if (!member) return null;

  const events = await prisma.event.findMany({
    where: { groupId, eventMembers: { some: { memberId } } },
    orderBy: { createdAt: "desc" },
    include: {
      bills: { where: { status: "unsettled" }, include: { splits: true } },
      eventMembers: { include: { member: { select: { id: true, name: true } } } },
    },
  });

  const results: MemberBalanceEvent[] = [];

  for (const event of events) {
    if (event.bills.length === 0) continue;

    const nets = computeNetBalances(
      event.bills.map((bill) => ({
        payerId: bill.payerId,
        totalAmount: bill.totalAmount,
        splits: bill.splits.map((split) => ({ memberId: split.memberId, shareAmount: split.shareAmount })),
      })),
    );
    const net = nets.get(memberId) ?? 0;
    if (net === 0) continue;

    const nameById = new Map(event.eventMembers.map(({ member: m }) => [m.id, m.name]));
    const transfers = simplifyDebts(nets)
      .filter((t) => t.fromMemberId === memberId || t.toMemberId === memberId)
      .map((t): MemberBalanceTransfer => {
        const isPayer = t.fromMemberId === memberId;
        const otherMemberId = isPayer ? t.toMemberId : t.fromMemberId;
        return {
          otherMemberId,
          otherName: nameById.get(otherMemberId) ?? "",
          direction: isPayer ? "pays" : "receives",
          amount: t.amount,
        };
      });

    results.push({ id: event.id, name: event.name, currency: event.currency, net, transfers });
  }

  return { events: results };
}
