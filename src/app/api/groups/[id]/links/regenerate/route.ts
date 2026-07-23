import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { generateShareToken } from "@/lib/auth/token";
import { prisma } from "@/lib/prisma";
import { regenerateLinkSchema } from "@/lib/validation/group";

// Revokes the current active link of the given role and issues a new one.
// The old link stops resolving immediately, no grace period (Screen Spec
// P2-03) — including for the caller's own session if they just regenerated
// the role their session is using; they must pick up the new link like
// anyone else.
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
  const parsed = regenerateLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const newLink = await prisma.$transaction(async (tx) => {
    await tx.groupShareLink.updateMany({
      where: { groupId, role: parsed.data.role, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return tx.groupShareLink.create({
      data: { groupId, role: parsed.data.role, token: generateShareToken() },
    });
  });

  return NextResponse.json({
    link: {
      id: newLink.id,
      role: newLink.role,
      token: newLink.token,
      createdAt: newLink.createdAt,
    },
  });
}
