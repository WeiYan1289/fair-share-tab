import { prisma } from "@/lib/prisma";

export interface GroupMemberSummary {
  id: string;
  name: string;
  avatarColor: string;
  isActive: boolean;
}

/** Shared by the /events page's member list -- no balance, no per-event
 * context, just who's in the group. Inactive members stay listed
 * (CLAUDE.md rule 4: members are never deleted) -- MemberChip's own
 * opacity/label handles signaling that, same as it already does on the
 * event dashboard. */
export async function listGroupMembers(groupId: string): Promise<GroupMemberSummary[]> {
  return prisma.member.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, avatarColor: true, isActive: true },
  });
}
