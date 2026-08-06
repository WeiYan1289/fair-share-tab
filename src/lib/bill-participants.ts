/**
 * Every member who appears anywhere in an event's bills, as payer or as a
 * split participant.
 *
 * This exists to tell two very different zeros apart. A member with no
 * bills nets to 0, and so does a member who paid and owed exactly the same
 * amount -- but calling the first one "Settled up" claims they took part
 * and came out even, which is not true.
 *
 * Counts settled bills too: someone whose bills are all settled did take
 * part, and is genuinely square.
 */
export function collectBillParticipants(
  bills: { payerId: string; splits: { memberId: string }[] }[],
): Set<string> {
  const participants = new Set<string>();
  for (const bill of bills) {
    // The payer counts even when absent from the splits -- paying for a
    // bill you are not part of is explicitly allowed (CLAUDE.md).
    participants.add(bill.payerId);
    for (const split of bill.splits) {
      participants.add(split.memberId);
    }
  }
  return participants;
}
