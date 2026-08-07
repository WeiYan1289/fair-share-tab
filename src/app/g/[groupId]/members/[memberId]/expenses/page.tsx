import { redirect } from "next/navigation";
import { requireSession, SessionError, ArchivedGroupError } from "@/lib/auth/require-session";
import { getMemberExpenses } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { MemberExpenseView } from "@/components/members/MemberExpenseView";

// Screen Spec P4-06. requireSession() with no role requirement -- viewers
// see this too, same as everything else in the group (CLAUDE.md rule 5).
export default async function MemberExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string; memberId: string }>;
  searchParams: Promise<{ currency?: string }>;
}) {
  const { groupId, memberId } = await params;
  const { currency } = await searchParams;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof ArchivedGroupError) redirect("/group-archived");
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const [group, expenses] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    getMemberExpenses(memberId, groupId),
  ]);
  if (!group) redirect("/");
  if (!expenses) redirect(`/g/${groupId}/events`);

  return (
    <MemberExpenseView
      groupId={groupId}
      groupName={group.name}
      actorType={session.actorType}
      member={expenses.member}
      currencies={expenses.currencies}
      events={expenses.events.map((e) => ({
        ...e,
        startDate: e.startDate?.toISOString() ?? null,
        endDate: e.endDate?.toISOString() ?? null,
        lines: e.lines.map((line) => ({ ...line, createdAt: line.createdAt.toISOString() })),
      }))}
      initialCurrency={currency ?? null}
      hasArchivedEvents={expenses.hasArchivedEvents}
    />
  );
}
