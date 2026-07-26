import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { SessionError } from "@/lib/auth/require-session";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Mints a member-kind group-context session from the caller's
// GroupMembership and redirects to the events list — the authenticated
// counterpart to GET /g/{token} (src/app/g/[groupId]/route.ts), same
// destination either way. A plain GET so "Enter" in /account/groups can be
// a normal link/full-page navigation, no client-side fetch+redirect needed.
export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

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
