import { redirect } from "next/navigation";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { getMemberBalance } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { MemberBalanceView } from "@/components/members/MemberBalanceView";

// Screen Spec P4-07, sibling to the Expenses tab. requireSession() with no
// role requirement -- viewers see this too.
export default async function MemberBalancePage({
  params,
}: {
  params: Promise<{ groupId: string; memberId: string }>;
}) {
  const { groupId, memberId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const [group, memberRow, balance] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, avatarColor: true, isActive: true, groupId: true },
    }),
    getMemberBalance(memberId, groupId),
  ]);
  if (!group) redirect("/");
  if (!memberRow || memberRow.groupId !== groupId || !balance) redirect(`/g/${groupId}/events`);

  return (
    <MemberBalanceView
      groupId={groupId}
      groupName={group.name}
      actorType={session.actorType}
      member={memberRow}
      events={balance.events}
    />
  );
}
