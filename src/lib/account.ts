import { prisma } from "@/lib/prisma";

// Shared by the account/groups API route and the /account/groups Server
// Component (mirrors listGroupEvents in events.ts) so "which groups can
// this user act in" only lives in one place.
export async function listUserGroups(userId: string) {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      group: {
        include: { _count: { select: { members: { where: { isActive: true } }, events: true } } },
      },
    },
  });

  return memberships.map((membership) => ({
    groupId: membership.groupId,
    role: membership.role,
    name: membership.group.name,
    memberCount: membership.group._count.members,
    eventCount: membership.group._count.events,
  }));
}

// Used to prefill "Your name" when a logged-in member creates another group
// (CreateGroupModal) — Member.name stays per-group and independently
// editable (CLAUDE.md rule 6), this is only a UI default, never a synced
// field. Most-recently-created member row, on the assumption that's the
// name most likely to reflect how they currently want to be shown.
export async function getSuggestedMemberName(userId: string): Promise<string | null> {
  const member = await prisma.member.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { name: true },
  });
  return member?.name ?? null;
}

// Minimal shape of the two Prisma delegates getGroupOwner calls — narrower
// than PrismaClient so a fake object can stand in for it in tests, mirroring
// claim.ts's Prisma.TransactionClient parameter. The real `prisma` import
// satisfies this structurally; cast below because Prisma's generated
// findFirst overloads are far richer than this minimal shape and TS's
// bivariant method-parameter check doesn't always paper over that.
export interface GroupOwnerClient {
  groupMembership: {
    findFirst(args: {
      where: { groupId: string; role: "editor" };
      orderBy: { createdAt: "asc" };
      select: { userId: true };
    }): Promise<{ userId: string } | null>;
  };
  member: {
    findFirst(args: {
      where: { groupId: string; userId: string };
      select: { name: true };
    }): Promise<{ name: string } | null>;
  };
}

export interface GroupOwner {
  userId: string;
  memberName: string | null;
}

// The owner-badge / canClaim query (session-persistence-and-ownership
// design §1/§5): a group is "owned" exactly when a GroupMembership exists
// for it. The earliest editor membership is authoritative — claimVisitorGroup
// and POST /api/account/groups both only ever create one editor membership
// per group today, but "earliest" keeps this correct even if that changes.
// The member row lookup can come back empty (defensively typed, not
// expected in practice — every path that creates a GroupMembership also
// sets that same user's member.userId in the same transaction).
export async function getGroupOwner(
  groupId: string,
  client: GroupOwnerClient = prisma as unknown as GroupOwnerClient,
): Promise<GroupOwner | null> {
  const membership = await client.groupMembership.findFirst({
    where: { groupId, role: "editor" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (!membership) return null;

  const member = await client.member.findFirst({
    where: { groupId, userId: membership.userId },
    select: { name: true },
  });

  return { userId: membership.userId, memberName: member?.name ?? null };
}
