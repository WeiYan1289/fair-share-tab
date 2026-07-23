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
 * balances and simplified transfers. Settlement is group-scoped, not
 * event-scoped -- bills from several events in the group can settle
 * together even though the v1 UI only ever selects within one event
 * (system-design.md §4.1, data-model.md §8). Only unsettled bills belonging
 * to this group are ever eligible (system-design.md §7).
 */
export async function computeSettlementPreview(
  billIds: string[],
  groupId: string,
): Promise<{ netBalances: NetBalanceView[]; transfers: Transfer[]; billIds: string[] }> {
  const uniqueBillIds = [...new Set(billIds)];

  const bills = await prisma.bill.findMany({
    where: { id: { in: uniqueBillIds }, status: "unsettled", event: { groupId } },
    include: { splits: true },
  });

  if (bills.length !== uniqueBillIds.length) {
    throw new SettlementValidationError(
      "billIds must all be unsettled bills belonging to this group",
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

  const members = await prisma.member.findMany({
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
