import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { computeNetBalances, simplifyDebts, type Transfer } from "@/lib/settlement";

export class SettlementValidationError extends Error {}

export interface NetBalanceView {
  memberId: string;
  name: string;
  net: number;
}

/**
 * Loads and validates the bills a settlement run covers, then computes net
 * balances and simplified transfers. Settlement is strictly event-scoped --
 * a settlement always covers bills from exactly one event, which guarantees
 * a single currency by construction. Only unsettled bills belonging to this
 * event are ever eligible (system-design.md §7).
 *
 * Accepts an optional transaction client so the confirm route can run the
 * preview and the write inside one transaction -- otherwise a bill can be
 * edited, deleted, or settled by a second request in the gap between this
 * read and the write that follows it.
 */
export async function computeSettlementPreview(
  billIds: string[],
  eventId: string,
  client: Prisma.TransactionClient = prisma,
): Promise<{ netBalances: NetBalanceView[]; transfers: Transfer[]; billIds: string[] }> {
  const uniqueBillIds = [...new Set(billIds)];

  const bills = await client.bill.findMany({
    where: { id: { in: uniqueBillIds }, status: "unsettled", eventId },
    include: { splits: true },
  });

  if (bills.length !== uniqueBillIds.length) {
    throw new SettlementValidationError(
      "billIds must all be unsettled bills belonging to this event",
    );
  }

  const nets = computeNetBalances(
    bills.map((bill) => ({
      payerId: bill.payerId,
      totalAmount: bill.totalAmount,
      splits: bill.splits.map((split) => ({
        memberId: split.memberId,
        shareAmount: split.shareAmount,
      })),
    })),
  );

  const transfers = simplifyDebts(nets);

  const members = await client.member.findMany({
    where: { id: { in: [...nets.keys()] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const netBalances: NetBalanceView[] = [...nets.entries()].map(([memberId, net]) => ({
    memberId,
    name: nameById.get(memberId) ?? "",
    net,
  }));

  return { netBalances, transfers, billIds: uniqueBillIds };
}

/**
 * The cross-event counterpart to computeSettlementPreview. Loads the given
 * unsettled bills, then asserts server-side that they all belong to this
 * group, that every covered event is active (not archived), and that they
 * share exactly one currency -- the currency and archived guards live HERE,
 * never in the client (CLAUDE.md rules 1, 7, 11). A settlement then spans
 * multiple events; eventId is left null on the Settlement row and the covered
 * events are derivable via SettlementBill -> Bill -> eventId.
 *
 * Takes an optional transaction client so confirm can run preview + write in
 * one transaction, exactly like the event route.
 */
export async function computeGroupSettlementPreview(
  billIds: string[],
  groupId: string,
  client: Prisma.TransactionClient = prisma,
): Promise<{
  netBalances: NetBalanceView[];
  transfers: Transfer[];
  billIds: string[];
  eventIds: string[];
  currency: string;
}> {
  const uniqueBillIds = [...new Set(billIds)];

  const bills = await client.bill.findMany({
    where: { id: { in: uniqueBillIds }, status: "unsettled" },
    include: { splits: true, event: { select: { groupId: true, status: true, currency: true } } },
  });

  if (bills.length !== uniqueBillIds.length) {
    throw new SettlementValidationError("billIds must all be unsettled bills");
  }

  for (const bill of bills) {
    if (bill.event.groupId !== groupId) {
      throw new SettlementValidationError("All bills must belong to this group");
    }
    if (bill.event.status !== "active") {
      throw new SettlementValidationError("Archived events cannot be settled");
    }
  }

  const currencies = new Set(bills.map((b) => b.event.currency));
  if (currencies.size > 1) {
    throw new SettlementValidationError("All bills must share one currency");
  }
  const currency = [...currencies][0];

  const nets = computeNetBalances(
    bills.map((bill) => ({
      payerId: bill.payerId,
      totalAmount: bill.totalAmount,
      splits: bill.splits.map((split) => ({ memberId: split.memberId, shareAmount: split.shareAmount })),
    })),
  );
  const transfers = simplifyDebts(nets);

  const members = await client.member.findMany({
    where: { id: { in: [...nets.keys()] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(members.map((m) => [m.id, m.name]));

  const netBalances: NetBalanceView[] = [...nets.entries()].map(([memberId, net]) => ({
    memberId,
    name: nameById.get(memberId) ?? "",
    net,
  }));

  const eventIds = [...new Set(bills.map((b) => b.eventId))];

  return { netBalances, transfers, billIds: uniqueBillIds, eventIds, currency };
}
