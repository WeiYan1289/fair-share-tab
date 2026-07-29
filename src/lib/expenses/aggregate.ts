import type { SplitShare } from "@/lib/settlement/types";

export interface ExpenseBill {
  billId: string;
  title: string;
  totalAmount: number;
  payerId: string;
  createdAt: Date;
  splits: SplitShare[];
}

export interface MemberBillLine {
  billId: string;
  title: string;
  totalAmount: number;
  payerId: string;
  isPayer: boolean;
  /** This member's share of the bill total; 0 if they aren't a participant. */
  shareAmount: number;
  createdAt: Date;
}

export interface MemberEventExpense {
  share: number;
  paid: number;
  lines: MemberBillLine[];
}

/**
 * Aggregates one member's spend across whatever bills are passed in --
 * unlike computeNetBalances (settlement/net-balances.ts), which nets only
 * unsettled bills to answer "who owes whom right now", this function has
 * no notion of settled/unsettled at all. The caller decides which bills to
 * include; passed a whole event's history (settled and unsettled alike) it
 * answers "what has this person actually spent", which a settlement never
 * erases just because the debt it created has since been paid off.
 *
 * A bill is only included in `lines` if the member is its payer, a
 * participant (has a split row), or both -- someone unconnected to the
 * bill doesn't belong in their own spend history.
 */
export function computeMemberEventExpense(memberId: string, bills: ExpenseBill[]): MemberEventExpense {
  let share = 0;
  let paid = 0;
  const lines: MemberBillLine[] = [];

  for (const bill of bills) {
    const split = bill.splits.find((s) => s.memberId === memberId);
    const isPayer = bill.payerId === memberId;
    if (!split && !isPayer) continue;

    const shareAmount = split?.shareAmount ?? 0;
    share += shareAmount;
    if (isPayer) paid += bill.totalAmount;

    lines.push({
      billId: bill.billId,
      title: bill.title,
      totalAmount: bill.totalAmount,
      payerId: bill.payerId,
      isPayer,
      shareAmount,
      createdAt: bill.createdAt,
    });
  }

  lines.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return { share, paid, lines };
}
