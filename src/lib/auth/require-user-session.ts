import { cookies } from "next/headers";
import { USER_SESSION_COOKIE_NAME, verifyUserSession } from "./session";
import { SessionError } from "./require-session";

/**
 * The account-identity counterpart to requireSession(): "who is logged in,"
 * independent of any group. Throws SessionError(401) if no valid
 * fst_user_session cookie is present. Unlike requireSession(), there is no
 * per-request revocation check against the database — the user session is
 * invalidated by logging out (which clears the cookie), not by a
 * server-side flag (session.ts's USER_SESSION_COOKIE_OPTIONS comment).
 */
export async function requireUserSession(): Promise<{ userId: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new SessionError(401, "Not logged in");
  }
  return { userId };
}

/** Non-throwing variant for optional-auth call sites (e.g. POST /api/groups). */
export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(USER_SESSION_COOKIE_NAME)?.value;
  const payload = verifyUserSession(raw);
  return payload?.userId ?? null;
}
