import { prisma } from "@/lib/prisma";
import type { UpdateGroupInput } from "@/lib/validation/group";

// Thrown by assertGroupNotArchived; the account/groups PATCH route catches
// this the same way the events PATCH route catches ArchivedEventError --
// instanceof check, then `NextResponse.json({ error: error.message },
// { status: error.status })`. Mirrors ArchivedEventError in events.ts.
export class ArchivedGroupError extends Error {
  status = 409 as const;

  constructor(message: string) {
    super(message);
  }
}

// Archived means sealed (CLAUDE.md rule 4): every write on an archived
// group must 409, with one exception -- the account/groups PATCH route
// that restores status to "active". That route does NOT call this helper
// when the request is restore-only; see isRestoreOnlyGroupPatch below.
// Mirrors assertEventNotArchived in events.ts.
export function assertGroupNotArchived(group: { status: string }, message: string): void {
  if (group.status === "archived") {
    throw new ArchivedGroupError(message);
  }
}

// The account/groups PATCH route's one exception to assertGroupNotArchived:
// a payload that ONLY restores status to "active" (nothing else) is let
// through against an archived group. Extracted as a named predicate --
// rather than left inline in the route -- specifically so it has direct
// Vitest coverage (CLAUDE.md's "small decision predicate" test category):
// this is a pure function of updateGroupSchema's shape, and if a field is
// ever added to that schema without being added here, the seal silently
// reopens for that field whenever it rides along with status:"active" on
// an archived group. Mirrors isRestoreOnlyEventPatch in events.ts.
export function isRestoreOnlyGroupPatch(data: UpdateGroupInput): boolean {
  return data.status === "active" && data.name === undefined;
}

// Shared by the account/groups API route and the /account/groups Server
// Component (mirrors listGroupEvents in events.ts) so "which groups can
// this user act in" only lives in one place.
export async function listUserGroups(userId: string) {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      group: {
        include: {
          _count: { select: { members: { where: { isActive: true } }, events: true } },
          memberships: {
            where: { role: "editor" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { userId: true },
          },
        },
      },
    },
  });

  return memberships.map((membership) => ({
    groupId: membership.groupId,
    role: membership.role,
    name: membership.group.name,
    status: membership.group.status,
    isOwner: membership.group.memberships[0]?.userId === userId,
    memberCount: membership.group._count.members,
    eventCount: membership.group._count.events,
  }));
}

// Backs the archived-groups screen (archived-readonly T4): a ruled list,
// not the card grid, so it only needs the fields that list actually
// renders. No money figure -- a group spans events that may each use a
// different currency, so any single total would either be wrong or
// silently mix currencies (CLAUDE.md rule 1). Ordered by archivedAt desc,
// nulls last (rows archived before T0 added the column), then createdAt
// desc, mirroring listArchivedGroupEvents in events.ts.
export async function listArchivedUserGroups(userId: string) {
  const memberships = await prisma.groupMembership.findMany({
    where: { userId, group: { status: "archived" } },
    orderBy: [
      { group: { archivedAt: { sort: "desc", nulls: "last" } } },
      { group: { createdAt: "desc" } },
    ],
    include: {
      group: {
        include: {
          _count: { select: { members: { where: { isActive: true } }, events: true } },
          memberships: {
            where: { role: "editor" },
            orderBy: { createdAt: "asc" },
            take: 1,
            select: { userId: true },
          },
        },
      },
    },
  });

  return memberships.map((membership) => ({
    groupId: membership.groupId,
    name: membership.group.name,
    isOwner: membership.group.memberships[0]?.userId === userId,
    memberCount: membership.group._count.members,
    eventCount: membership.group._count.events,
    archivedAt: membership.group.archivedAt,
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
