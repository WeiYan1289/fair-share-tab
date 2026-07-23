import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { updateMemberSchema } from "@/lib/validation/member";

// Renames a member and/or sets is_active. No delete endpoint exists anywhere
// in this API (data-model.md invariant 6) — deactivation is the only
// removal path, and it's reversible by setting isActive back to true
// (Screen Spec P4-04 "Reactivate").
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = await params;

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
  const parsed = updateMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.member.findUnique({ where: { id: memberId } });

  // Same 404 whether the member doesn't exist at all or belongs to a
  // different group — an editor session for group A shouldn't be able to
  // tell group B's member ids apart from nonexistent ones.
  if (!existing || existing.groupId !== session.groupId) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  const member = await prisma.member.update({
    where: { id: memberId },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.isActive !== undefined && { isActive: parsed.data.isActive }),
    },
  });

  return NextResponse.json({
    member: {
      id: member.id,
      name: member.name,
      email: member.email,
      isActive: member.isActive,
      avatarColor: member.avatarColor,
      createdAt: member.createdAt,
    },
  });
}
