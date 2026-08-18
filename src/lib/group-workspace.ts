import { prisma } from "@/lib/prisma";
import { getEventDetail } from "@/lib/events";
import { getGroupCurrencyOverviews, type GroupCurrencyOverview } from "@/lib/expenses";

type EventDetail = NonNullable<Awaited<ReturnType<typeof getEventDetail>>>;

// Everything the desktop group workspace page needs, composed from existing
// (already-tested) functions. Active events only -- archived events are
// excluded by construction (CLAUDE.md rules 4/11), same as the events list.
//
// This runs N per-event loads plus one combined-balances query. That is fine
// for typical groups (it mirrors the query each event dashboard already runs);
// deferring collapsed blocks' bill lists is a documented follow-up (spec
// "Open risks") if a real group grows large.
export async function getGroupWorkspaceData(
  groupId: string,
): Promise<{ events: EventDetail[]; overviews: GroupCurrencyOverview[] } | null> {
  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) return null;

  const eventRows = await prisma.event.findMany({
    where: { groupId, status: "active" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  const [details, overviews] = await Promise.all([
    Promise.all(eventRows.map((e) => getEventDetail(e.id, groupId))),
    getGroupCurrencyOverviews(groupId),
  ]);

  const events = details.filter((d): d is EventDetail => d !== null);
  return { events, overviews };
}
