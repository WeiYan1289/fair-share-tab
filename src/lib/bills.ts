import { prisma } from "@/lib/prisma";
import { computeEqualSplit, splitsReconcile, type SplitShare } from "@/lib/settlement";
import type { BillInput } from "@/lib/validation/bill";

export class BillValidationError extends Error {}

/**
 * Resolves a bill's split amounts server-side, independent of whatever the
 * client computed (system-design.md §6.3 "Server re-validates
 * independently"). Verifies the payer and every participant belong to the
 * group, then either computes the deterministic equal split or checks that
 * a custom split reconciles to the total exactly.
 */
export async function resolveBillSplits(
  input: BillInput,
  groupId: string,
): Promise<{ payerId: string; splits: SplitShare[] }> {
  const participantIds =
    input.splitMethod === "equal"
      ? input.participantIds
      : input.customShares.map((s) => s.memberId);

  const referencedMemberIds = [...new Set([input.payerId, ...participantIds])];

  const members = await prisma.member.findMany({
    where: { id: { in: referencedMemberIds }, groupId },
    select: { id: true, createdAt: true },
  });

  if (members.length !== referencedMemberIds.length) {
    throw new BillValidationError("Payer and every participant must belong to this group");
  }

  if (input.splitMethod === "equal") {
    const participants = members
      .filter((m) => input.participantIds.includes(m.id))
      .map((m) => ({ memberId: m.id, createdAt: m.createdAt }));

    return { payerId: input.payerId, splits: computeEqualSplit(input.totalAmount, participants, input.payerId) };
  }

  if (!splitsReconcile(input.totalAmount, input.customShares)) {
    throw new BillValidationError("Splits do not sum to totalAmount");
  }

  return { payerId: input.payerId, splits: input.customShares };
}

interface BillWithSplits {
  id: string;
  eventId: string;
  payerId: string;
  title: string;
  totalAmount: number;
  splitMethod: string;
  status: string;
  category: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
  splits: { memberId: string; shareAmount: number }[];
}

export function serializeBill(bill: BillWithSplits) {
  return {
    id: bill.id,
    eventId: bill.eventId,
    payerId: bill.payerId,
    title: bill.title,
    totalAmount: bill.totalAmount,
    splitMethod: bill.splitMethod,
    status: bill.status,
    category: bill.category,
    note: bill.note,
    createdAt: bill.createdAt,
    updatedAt: bill.updatedAt,
    splits: bill.splits.map((s) => ({ memberId: s.memberId, shareAmount: s.shareAmount })),
  };
}
