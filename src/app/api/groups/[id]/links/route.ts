import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";

// Editor-only: the docs leave open whether a viewer can ever reach the Share
// dialog (system-design.md README "Known gaps"), but returning the editor
// link's token to a viewer session would let them hand out edit access,
// silently defeating the view-only restriction. Restricting to editors is
// the safe reading until that gap is resolved.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const links = await prisma.groupShareLink.findMany({
    where: { groupId, revokedAt: null },
    select: { id: true, role: true, token: true, createdAt: true },
  });

  return NextResponse.json({ links });
}
