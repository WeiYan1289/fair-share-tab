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
