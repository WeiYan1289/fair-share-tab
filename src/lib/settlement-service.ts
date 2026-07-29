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
