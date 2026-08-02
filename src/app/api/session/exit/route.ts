import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { VISITOR_CAP_COOKIE_NAME } from "@/lib/auth/visitor-cap";

// Lets a visitor deliberately leave the group whose link they're holding
// (session-persistence-and-ownership design §4) — the group-context cookie
// today is only ever replaced (a new link, or entering a group from the
// account dashboard), never cleared on its own. Deliberately does not call
// requireSession(): exiting must work even from a revoked or malformed
// session, which is exactly when someone is most likely to want out.
// Mirrors /api/auth/logout's shape, but clears the group cookie instead of
// the account one.
//
// Also clears the visitor-cap cookie (fst_visitor_created_group). Without
// this, a guest who created a group is left both without the group session
// AND still capped from POST /api/groups (system-design.md §3.3, "one group
// per visitor") — locked out of the group they left and unable to create a
// replacement. Clearing the cap on exit is a deliberate trade-off: it lets
// them create a new group immediately, at the cost of permanently
// forfeiting the ability to register later and claim the group they just
// exited (computeCanClaim/claimVisitorGroup need this exact cap to know
// which group is claimable) — the same accepted dead end the design already
// documents for a guest who clears cookies, just now reachable via a button
// too.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete(VISITOR_CAP_COOKIE_NAME);
  return new NextResponse(null, { status: 204 });
}
