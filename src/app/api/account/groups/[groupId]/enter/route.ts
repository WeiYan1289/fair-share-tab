import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { SessionError } from "@/lib/auth/require-session";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Mints a member-kind group-context session from the caller's
// GroupMembership and redirects to the events list — the authenticated
// counterpart to GET /g/{token} (src/app/g/[groupId]/route.ts), same
// destination either way. POST, submitted via a <form> for a normal
// full-page navigation with no client-side fetch+redirect needed: a GET
// here would be a state-changing request that sets a cookie, which
// sameSite:"lax" does not stop for a top-level cross-site GET navigation.
export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  let session;
  try {
    session = await requireUserSession();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
    }
    throw error;
  }

  const membership = await prisma.groupMembership.findUnique({
    where: { groupId_userId: { groupId, userId: session.userId } },
  });

  if (!membership) {
    return new NextResponse("You don't have access to this group.", { status: 404 });
  }

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { status: true } });
  if (!group) {
    return new NextResponse("Group not found.", { status: 404 });
  }
  if (group.status === "archived") {
    return NextResponse.redirect(new URL("/group-archived", request.url), { status: 303 });
  }

  const groupSession = signSession({
    kind: "member",
    groupId,
    role: membership.role,
    userId: session.userId,
    membershipId: membership.id,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, groupSession, SESSION_COOKIE_OPTIONS);

  return NextResponse.redirect(new URL(`/g/${groupId}/events`, request.url), { status: 303 });
}
