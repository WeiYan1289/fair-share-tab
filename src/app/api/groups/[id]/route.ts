import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

// GET: group name plus active members, for screens that need a lightweight
// group header without loading a full events list. Any valid session
// (editor or viewer) can read. No current caller in src/ — pre-existing
// dead code from before the link-access refactor, kept as-is (out of scope
// here).
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
    group: { id: group.id, name: group.name },
    members: group.members,
  });
}
