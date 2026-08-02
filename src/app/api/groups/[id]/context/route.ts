import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGroupOwner } from "@/lib/account";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { VISITOR_CAP_COOKIE_NAME, computeCanClaim, verifyVisitorCapCookie } from "@/lib/auth/visitor-cap";

// Backs the owner badge (GroupOwnerBadge) and ShareDialog's regeneration
// nudge (session-persistence-and-ownership design §1/§5). Any valid session
// for this group — editor or viewer, member or visitor — can read it: it
// discloses only a member name (already visible to every link holder,
// CLAUDE.md rule 5) and whether the caller specifically can claim the
// group, never anything about other users.
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

  const owner = await getGroupOwner(groupId);

  const cookieStore = await cookies();
  const cap = verifyVisitorCapCookie(cookieStore.get(VISITOR_CAP_COOKIE_NAME)?.value);

  return NextResponse.json({
    hasOwner: owner !== null,
    ownerName: owner?.memberName ?? null,
    canClaim: computeCanClaim({ hasOwner: owner !== null, cap, groupId }),
  });
}
