import type { EqualSplitParticipant, SplitShare } from "./types";

/**
 * Divides `totalAmount` (integer sen) evenly among `participants`.
 * The leftover sen from an uneven division go one-by-one to the payer first
 * (if they're a participant), then to the remaining participants ordered by
 * `createdAt` ascending. The sum of returned shares always equals
 * `totalAmount` exactly.
 */
export function computeEqualSplit(
  totalAmount: number,
  participants: EqualSplitParticipant[],
  payerId?: string,
): SplitShare[] {
  if (participants.length === 0) {
    throw new Error("computeEqualSplit requires at least one participant");
  }
  if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
    throw new Error("computeEqualSplit requires a positive integer totalAmount");
  }

  const n = participants.length;
  const base = Math.floor(totalAmount / n);
  const remainder = totalAmount - base * n;

  const shares = new Map<string, number>();
  for (const participant of participants) {
    shares.set(participant.memberId, base);
  }

  const payer = participants.find((p) => p.memberId === payerId);
  const rest = participants
    .filter((p) => p.memberId !== payerId)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const remainderOrder = payer ? [payer, ...rest] : rest;

  for (let i = 0; i < remainder; i++) {
    const memberId = remainderOrder[i].memberId;
    shares.set(memberId, shares.get(memberId)! + 1);
  }

  return participants.map((p) => ({
    memberId: p.memberId,
    shareAmount: shares.get(p.memberId)!,
  }));
}

/** Whether a set of splits sums exactly to the bill's total amount. */
export function splitsReconcile(totalAmount: number, splits: SplitShare[]): boolean {
  const sum = splits.reduce((acc, s) => acc + s.shareAmount, 0);
  return sum === totalAmount;
}
