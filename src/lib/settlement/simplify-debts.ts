import type { NetBalances, Transfer } from "./types";

interface Balance {
  memberId: string;
  amount: number;
}

/**
 * Greedy max-debtor-to-max-creditor matching. Reroutes who pays whom without
 * changing anyone's net position. At most N-1 transfers for N members with a
 * nonzero net. Members with a zero net never appear as either side of a
 * transfer.
 */
export function simplifyDebts(nets: NetBalances): Transfer[] {
  const creditors: Balance[] = [];
  const debtors: Balance[] = [];

  for (const [memberId, net] of nets) {
    if (net > 0) creditors.push({ memberId, amount: net });
    else if (net < 0) debtors.push({ memberId, amount: -net });
  }

  const transfers: Transfer[] = [];

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    const creditor = creditors[0];
    const debtor = debtors[0];
    const amount = Math.min(creditor.amount, debtor.amount);

    transfers.push({ fromMemberId: debtor.memberId, toMemberId: creditor.memberId, amount });

    creditor.amount -= amount;
    debtor.amount -= amount;

    if (creditor.amount === 0) creditors.shift();
    if (debtor.amount === 0) debtors.shift();
  }

  return transfers;
}
