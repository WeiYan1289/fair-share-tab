import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/require-user-session";
import { listUserGroups } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { MyGroupsView } from "@/components/account/MyGroupsView";

// Server Component: reads the account-identity session and loads data
// directly via Prisma (CLAUDE.md rule 7), mirroring the events list page's
// convention (src/app/g/[groupId]/events/page.tsx).
export default async function MyGroupsPage() {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) redirect("/login");

  const groups = await listUserGroups(userId);

  return <MyGroupsView email={user.email} groups={groups} />;
}
