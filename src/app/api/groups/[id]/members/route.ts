import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { assignAvatarColor } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { createMemberSchema } from "@/lib/validation/member";

// Adds a member to the group (system-design.md §5 "Members"). There is no
// delete endpoint anywhere in this API — members are only ever deactivated
// via PATCH /api/members/{id} (data-model.md invariant 6).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;

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

  if (session.groupId !== groupId) {
    return NextResponse.json({ error: "Session does not match this group" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const member = await prisma.member.create({
    data: {
      groupId,
      name: parsed.data.name,
      email: parsed.data.email,
      avatarColor: assignAvatarColor(),
    },
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
