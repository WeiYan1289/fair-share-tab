import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { assignAvatarColor } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { createMemberSchema } from "@/lib/validation/member";

// Adds a brand-new member and attaches them to this event in one step
// (Screen Spec P4-04 "+ Add member" from the event dashboard/P4-03 empty
// state). Not documented as a standalone endpoint in system-design.md §5 --
// that doc only covers adding a member to the *group*
// (POST /api/groups/{id}/members) -- but P4-04's "Add member" is entered
// from inside an event and should make the new person immediately available
// for splitting bills on this trip, not just exist in the group with no
// event membership.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = await params;

  let session;
  try {
    assertSameOrigin(request);
    session = await requireSession({ role: "editor" });
  } catch (error) {
    if (error instanceof CsrfError || error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.groupId !== session.groupId) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const member = await prisma.$transaction(async (tx) => {
    const created = await tx.member.create({
      data: {
        groupId: session.groupId,
        name: parsed.data.name,
        email: parsed.data.email,
        avatarColor: assignAvatarColor(),
      },
    });
    await tx.eventMember.create({ data: { eventId, memberId: created.id } });
    return created;
  });

  return NextResponse.json(
    {
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        isActive: member.isActive,
        avatarColor: member.avatarColor,
        createdAt: member.createdAt,
      },
    },
    { status: 201 },
  );
}
