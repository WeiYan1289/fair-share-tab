import type { Prisma } from "@/generated/prisma/client";

export interface ClaimVisitorGroupInput {
  memberId: string;
  groupId: string;
  userId: string;
}

export interface ClaimVisitorGroupResult {
  claimed: boolean;
  membershipId?: string;
}

/**
 * Links a visitor-created group into a newly registered account: sets the
 * creator member's user_id and grants a matching editor GroupMembership, in
 * the caller's transaction. Only ever targets the specific member the
 * visitor created (data-model.md §9) — never derived from an arbitrary held
 * session, since a share-link session carries no identity of which member
 * its holder is.
 *
 * A no-op (not an overwrite) if the member doesn't exist, belongs to a
 * different group than claimed, or was already linked to some account —
 * claiming is one-directional and never contested.
 */
export async function claimVisitorGroup(
  tx: Prisma.TransactionClient,
  { memberId, groupId, userId }: ClaimVisitorGroupInput,
): Promise<ClaimVisitorGroupResult> {
  const member = await tx.member.findUnique({ where: { id: memberId } });
  if (!member || member.groupId !== groupId || member.userId !== null) {
    return { claimed: false };
  }

  await tx.member.update({ where: { id: memberId }, data: { userId } });

  const membership = await tx.groupMembership.create({
    data: { groupId, userId, role: "editor" },
  });

  return { claimed: true, membershipId: membership.id };
}
