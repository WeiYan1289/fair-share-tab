import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, verifySession, type SessionPayload } from "./session";

export class SessionError extends Error {
  status: 401 | 403;

  constructor(status: 401 | 403, message: string) {
    super(message);
    this.status = status;
  }
}

// actorType lets UI code (e.g. ShareDialog) branch on "is this an anonymous
// visitor or a registered member" without re-deriving it from payload.kind
// itself. userId is only present for member-kind sessions.
export type ResolvedSession = SessionPayload & { actorType: "member" | "visitor" };

/**
 * Reads and verifies the group-context session cookie, then re-checks the
 * underlying credential against the database — required on every request,
 * not just at exchange time (system-design.md §8). The credential is either
 * a share link (`kind: "link"`, today's anonymous flow) or a registered
 * user's group membership (`kind: "member"`) — both coexist permanently
 * (data-model.md §9). Throws SessionError on any failure; callers turn that
 * into a 401/403 response.
 */
export async function requireSession(options?: { role?: "editor" }): Promise<ResolvedSession> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySession(raw);

  if (!payload) {
    throw new SessionError(401, "No valid session");
  }

  if (payload.kind === "link") {
    const link = await prisma.groupShareLink.findUnique({ where: { id: payload.shareLinkId } });
    if (!link || link.revokedAt !== null || link.groupId !== payload.groupId) {
      throw new SessionError(401, "This link has been revoked");
    }
  } else {
    const membership = await prisma.groupMembership.findUnique({ where: { id: payload.membershipId } });
    if (!membership || membership.groupId !== payload.groupId || membership.userId !== payload.userId) {
      throw new SessionError(401, "This membership no longer grants access");
    }
  }

  if (options?.role === "editor" && payload.role !== "editor") {
    throw new SessionError(403, "Editor access required");
  }

  return { ...payload, actorType: payload.kind === "member" ? "member" : "visitor" };
}

/**
 * Used only by the homepage redirect (session-persistence-and-ownership
 * design §2/§3): resolves the group a valid fst_session currently points
 * at, or null if there is none, or it's malformed, or its underlying link
 * or membership has been revoked. Calls requireSession() rather than
 * reading the cookie directly so a visitor whose link was revoked falls
 * through to the marketing landing page instead of bouncing toward a group
 * they can no longer open.
 *
 * The try/catch must stay inside this helper. redirect() from
 * next/navigation works by throwing a special error; a caller that wrapped
 * its own call to this function in a try/catch spanning a redirect() call
 * would swallow that throw and silently break the redirect.
 */
export async function resolveActiveGroupId(): Promise<string | null> {
  try {
    const session = await requireSession();
    return session.groupId;
  } catch (error) {
    if (error instanceof SessionError) return null;
    throw error;
  }
}
