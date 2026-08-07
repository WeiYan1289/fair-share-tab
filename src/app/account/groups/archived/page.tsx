import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/require-user-session";
import { listArchivedUserGroups } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { formatShortDate } from "@/lib/format";
import { ArchivedGroupsView } from "@/components/account/ArchivedGroupsView";

// Screen addendum (archived-readonly T4): the option-B entry point on
// /account/groups links here. Account-level auth (getCurrentUserId,
// redirect to /login) -- NOT requireSession/ArchivedGroupError, because
// this page lives outside any single group's session and lists groups
// across accounts, mirroring /account/groups/page.tsx's own idiom. Also
// re-checks the user row exists (redirect to /login if not), matching the
// sibling /account/groups/page.tsx -- a stale cookie for a deleted user
// used to fall through here silently.
export default async function ArchivedGroupsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) redirect("/login");

  const groups = await listArchivedUserGroups(userId);

  return (
    <ArchivedGroupsView
      email={user.email}
      groups={groups.map((group) => ({
        groupId: group.groupId,
        name: group.name,
        isOwner: group.isOwner,
        memberCount: group.memberCount,
        eventCount: group.eventCount,
        // Formatted here, server-side, exactly once -- not passed as a raw
        // ISO timestamp for the client component to reformat. The server
        // runs UTC and users run UTC+8, so a client-side toLocaleDateString
        // on the same timestamp could render a different (earlier) day for
        // anything archived between 00:00 and 08:00 MYT, plus a hydration
        // mismatch since the two renders would disagree.
        archivedAtLabel: group.archivedAt ? formatShortDate(group.archivedAt) : null,
      }))}
    />
  );
}
