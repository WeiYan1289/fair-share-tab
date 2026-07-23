import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { createEventSchema } from "@/lib/validation/event";

// GET: list events with computed total spend and unsettled amount
// (system-design.md §5 "Events"). Any valid session (editor or viewer) can
// read.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (session.groupId !== groupId) {
    return NextResponse.json({ error: "Session does not match this group" }, { status: 403 });
  }

  const events = await prisma.event.findMany({
    where: { groupId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { eventMembers: true } },
      bills: { select: { totalAmount: true, status: true } },
    },
  });

  return NextResponse.json({
    events: events.map((event) => ({
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
      memberCount: event._count.eventMembers,
      totalSpend: event.bills.reduce((sum, bill) => sum + bill.totalAmount, 0),
      unsettledAmount: event.bills
        .filter((bill) => bill.status === "unsettled")
        .reduce((sum, bill) => sum + bill.totalAmount, 0),
    })),
  });
}

// POST: create an event scoped to this group, editor-only. If memberIds is
// omitted, every currently-active group member is included by default
// (Screen Spec P3-04 -- the UI never lets you pick members at creation;
// trip-specific people are added afterward from the event dashboard).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;

  let session;
  try {
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (session.groupId !== groupId) {
    return NextResponse.json({ error: "Session does not match this group" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, startDate, endDate, memberIds } = parsed.data;

  let resolvedMemberIds: string[];
  if (memberIds) {
    const matched = await prisma.member.findMany({
      where: { id: { in: memberIds }, groupId },
      select: { id: true },
    });
    if (matched.length !== memberIds.length) {
      return NextResponse.json(
        { error: "One or more memberIds do not belong to this group" },
        { status: 400 },
      );
    }
    resolvedMemberIds = memberIds;
  } else {
    const activeMembers = await prisma.member.findMany({
      where: { groupId, isActive: true },
      select: { id: true },
    });
    resolvedMemberIds = activeMembers.map((m) => m.id);
  }

  const event = await prisma.$transaction(async (tx) => {
    const created = await tx.event.create({
      data: {
        groupId,
        name,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      },
    });

    if (resolvedMemberIds.length > 0) {
      await tx.eventMember.createMany({
        data: resolvedMemberIds.map((memberId) => ({ eventId: created.id, memberId })),
      });
    }

    return created;
  });

  return NextResponse.json(
    {
      event: {
        id: event.id,
        name: event.name,
        startDate: event.startDate,
        endDate: event.endDate,
        status: event.status,
        memberIds: resolvedMemberIds,
      },
    },
    { status: 201 },
  );
}
