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

/**
 * Reads and verifies the session cookie, then re-checks the underlying
 * share link's `revoked_at` against the database — required on every
 * request, not just at exchange time (system-design.md §8). Throws
 * SessionError on any failure; callers turn that into a 401/403 response.
 */
export async function requireSession(options?: { role?: "editor" }): Promise<SessionPayload> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = verifySession(raw);

  if (!payload) {
    throw new SessionError(401, "No valid session");
  }

  const link = await prisma.groupShareLink.findUnique({ where: { id: payload.shareLinkId } });
  if (!link || link.revokedAt !== null || link.groupId !== payload.groupId) {
    throw new SessionError(401, "This link has been revoked");
  }

  if (options?.role === "editor" && payload.role !== "editor") {
    throw new SessionError(403, "Editor access required");
  }

  return payload;
}
