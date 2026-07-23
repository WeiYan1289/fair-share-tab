import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

// GET: group name plus active members, for screens that need to render an
// identity picker (P2-04 join) or header (P3-01 switcher, P4-01 dashboard)
// without loading a full events list. Any valid session (editor or viewer)
// can read.
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

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      currency: true,
      members: {
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, avatarColor: true },
      },
    },
  });

  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  return NextResponse.json({
    group: { id: group.id, name: group.name, currency: group.currency },
    members: group.members,
  });
}
