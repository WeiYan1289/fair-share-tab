import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";

// Only clears the account-identity cookie. Deliberately leaves any
// group-context session (fst_session) untouched — logging out of the
// account shouldn't kick the browser out of a group it's currently viewing
// (e.g. a share-link session for a friend's group is unrelated).
export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(USER_SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
