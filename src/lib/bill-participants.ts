/** A member as rendered in a participant avatar strip. */
export interface ParticipantMember {
  id: string;
  name: string;
  avatarColor: string;
}

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

/**
 * The members who actually owe money on a bill, in the event's canonical
 * order. A split with shareAmount === 0 (a custom split that zeroes someone
 * out) is excluded — this is display-only and never touches balances or
 * settlement (CLAUDE.md rules 2/3/11).
 *
 * Edge case: a tiny-total equal split like RM 0.01 / 3 -> [1,0,0] leaves a
 * single participant. That is correct, not a bug — a 0-share member is not
 * financially participating.
 */
export function selectBillParticipants(
  splits: { memberId: string; shareAmount: number }[],
  orderedMembers: ParticipantMember[],
): ParticipantMember[] {
  const paying = new Set(
    splits.filter((s) => s.shareAmount > 0).map((s) => s.memberId),
  );
  return orderedMembers.filter((m) => paying.has(m.id));
}
