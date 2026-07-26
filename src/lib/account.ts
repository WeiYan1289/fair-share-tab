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
