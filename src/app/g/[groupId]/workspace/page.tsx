import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireSession, SessionError, ArchivedGroupError } from "@/lib/auth/require-session";
import { getGroupWorkspaceData } from "@/lib/group-workspace";
import { prisma } from "@/lib/prisma";
import { GROUP_COLLAPSED_COOKIE, parseCollapsed } from "@/lib/view-cookie";
import { GroupWorkspace } from "@/components/workspace/GroupWorkspace";
import { DesktopWorkspaceRedirect } from "@/components/workspace/DesktopWorkspaceRedirect";
import type { WorkspaceEvent } from "@/components/workspace/EventWorkspaceBlock";

// Desktop-only one-page group workspace (spec). Same auth + data ownership as
// the event dashboard, loaded group-wide. Rendered at lg+ only; below lg a
// client guard sends the visitor back to the classic events list, so the
// layout is never shown on a small screen.
export default async function GroupWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ savelink?: string }>;
}) {
  const { groupId } = await params;
  const { savelink } = await searchParams;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof ArchivedGroupError) redirect("/group-archived");
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const [group, data, cookieStore] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    getGroupWorkspaceData(groupId),
    cookies(),
  ]);
  if (!group || !data) redirect("/");

  const initialCollapsed = [...parseCollapsed(cookieStore.get(GROUP_COLLAPSED_COOKIE)?.value)];

  const events: WorkspaceEvent[] = data.events.map((event) => ({
    id: event.id,
    groupId: event.groupId,
    name: event.name,
    currency: event.currency,
    startDate: event.startDate?.toISOString() ?? null,
    endDate: event.endDate?.toISOString() ?? null,
    status: event.status,
    totalSpend: event.totalSpend,
    members: event.members.map((m) => ({
      id: m.id,
      name: m.name,
      avatarColor: m.avatarColor,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
      balance: m.balance,
      share: m.share,
      paid: m.paid,
      inAnyBill: m.inAnyBill,
    })),
    bills: event.bills,
  }));

  return (
    <>
      <div className="hidden lg:block">
        <GroupWorkspace
          groupId={groupId}
          groupName={group.name}
          viewerRole={session.role}
          actorType={session.actorType}
          overviews={data.overviews}
          events={events}
          initialCollapsed={initialCollapsed}
          saveLinkToken={savelink ?? null}
        />
      </div>
      <div className="lg:hidden">
        <DesktopWorkspaceRedirect to={`/g/${groupId}/events`} />
      </div>
    </>
  );
}
