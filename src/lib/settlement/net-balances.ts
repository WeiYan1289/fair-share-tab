import type { BillForNetting, NetBalances } from "./types";

/**
 * For each member, net = SUM(bills paid) - SUM(shares owed) across the given
 * bills. Positive nets are owed money (creditor); negative nets owe money
 * (debtor). All nets sum to zero.
 */
export function computeNetBalances(bills: BillForNetting[]): NetBalances {
  const nets: NetBalances = new Map();

  for (const bill of bills) {
    nets.set(bill.payerId, (nets.get(bill.payerId) ?? 0) + bill.totalAmount);
    for (const split of bill.splits) {
      nets.set(split.memberId, (nets.get(split.memberId) ?? 0) - split.shareAmount);
    }
  }

  return nets;
}
