import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { getEventDetail } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { updateEventSchema } from "@/lib/validation/event";

// GET: detail with members, bills, and computed balances (system-design.md
// §5 "Events", Screen Spec P4-01).
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const event = await getEventDetail(eventId, session.groupId);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json({
    event: { ...event, memberCount: event.members.length },
  });
}

// PATCH: rename, change dates, or archive. Editor-only.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  let session;
  try {
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.event.findUnique({ where: { id: eventId } });
  if (!existing || existing.groupId !== session.groupId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { name, startDate, endDate, status } = parsed.data;
  const event = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(name !== undefined && { name }),
      ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(status !== undefined && { status }),
    },
  });

  return NextResponse.json({
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
      endDate: event.endDate,
      status: event.status,
    },
  });
}
