import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { SessionError } from "@/lib/auth/require-session";
import { getGroupOwner } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { updateGroupSchema } from "@/lib/validation/group";

// PATCH: rename a group from the My Groups page (spec 2026-08-06 feature
// A). Owner-only — same gate as share-link regeneration: the earliest
// editor GroupMembership (getGroupOwner) is the owner. Lives in the
// account namespace because the caller holds fst_user_session, not a
// group-context cookie (contrast /api/groups/[id], which requireSession()s
// the group cookie).
export async function PATCH(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  let session;
  try {
    assertSameOrigin(request);
    session = await requireUserSession();
  } catch (error) {
    if (error instanceof CsrfError || error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const owner = await getGroupOwner(groupId);
  if (!owner || owner.userId !== session.userId) {
    return NextResponse.json({ error: "Only the group owner can do this" }, { status: 403 });
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { name: parsed.data.name },
  });

  return NextResponse.json({ group: { id: updated.id, name: updated.name } });
}
