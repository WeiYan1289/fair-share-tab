import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { SESSION_COOKIE_NAME, USER_SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";

// Always clears the account-identity cookie. Also clears the group-context
// cookie (fst_session), but only when it's a `kind: "member"` session —
// that kind exists only as "acting in this group as this logged-in
// account," so it has no meaning once the account is gone, and the
// homepage redirect (session-persistence-and-ownership design §2/§3) would
// otherwise bounce a just-logged-out user straight back into the group
// they were viewing, making Log out look like it did nothing. A
// `kind: "link"` session is left untouched — it's an anonymous capability
// unrelated to any account (e.g. a share-link session for a friend's
// group), so an unrelated account logout must not clear it.
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
  const groupSession = verifySession(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (groupSession?.kind === "member") {
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
  cookieStore.delete(USER_SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
