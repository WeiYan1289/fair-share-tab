import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { USER_SESSION_COOKIE_NAME, verifyUserSession } from "./session";
import { SessionError } from "./require-session";
import { isSessionStale } from "./session-staleness";

/**
 * The account-identity counterpart to requireSession(): "who is logged in,"
 * independent of any group. Throws SessionError(401) if no valid
 * fst_user_session cookie is present.
 *
 * Like requireSession(), this now re-checks the database on every request:
 * a cookie issued before the account's last password change is rejected.
 * Without that check a password reset would lock out future logins while
 * leaving a cookie an attacker already holds working for its full one-year
 * maxAge — which is most of what resetting a password is supposed to fix.
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
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { passwordChangedAt: true },
  });
  // A deleted user's cookie is as invalid as a stale one.
  if (!user) return null;
  if (isSessionStale({ issuedAt: payload.issuedAt, passwordChangedAt: user.passwordChangedAt })) {
    return null;
  }

  return payload.userId;
}
