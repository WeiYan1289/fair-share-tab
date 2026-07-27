import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "fst_session";
export const USER_SESSION_COOKIE_NAME = "fst_user_session";

/**
 * The group-context session: "which group am I acting in, at what role,
 * right now." Backed by either an anonymous share link (today's flow) or a
 * registered user's group membership (system-design.md §3.1/§3.2) — both
 * mint the same cookie shape so every existing requireSession() call site
 * keeps working unchanged. A payload with no `kind` (cookies issued before
 * this union existed) is treated as `"link"` — see verifySession below.
 */
export type SessionPayload =
  | { kind: "link"; groupId: string; role: "editor" | "viewer"; shareLinkId: string }
  | { kind: "member"; groupId: string; role: "editor" | "viewer"; userId: string; membershipId: string };

/** The account-identity session: "who is logged in," independent of any group. */
export interface UserSessionPayload {
  userId: string;
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function sign(body: string): string {
  return createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
}

/** Signs an arbitrary JSON-serializable payload into an opaque, tamper-evident cookie value. */
export function signValue(payload: unknown): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Verifies a cookie value's HMAC signature and returns the decoded JSON, or
 * null if the signature is missing/invalid/tampered. Does not validate the
 * decoded shape — callers do that.
 */
export function verifyValue(cookieValue: string | undefined | null): unknown | null {
  if (!cookieValue) return null;

  const [body, signature] = cookieValue.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

/** Signs a group-context session payload into an opaque, tamper-evident cookie value. */
export function signSession(payload: SessionPayload): string {
  return signValue(payload);
}

/**
 * Verifies a cookie value's HMAC signature and shape. Does NOT check
 * revocation — callers must re-check the underlying share link or group
 * membership against the database on every request (system-design.md §8
 * "Revoked link mid-session"). See requireSession in require-session.ts.
 */
export function verifySession(cookieValue: string | undefined | null): SessionPayload | null {
  const payload = verifyValue(cookieValue) as Record<string, unknown> | null;
  if (!payload) return null;

  const roleValid = payload.role === "editor" || payload.role === "viewer";
  if (typeof payload.groupId !== "string" || !roleValid) return null;
  const groupId = payload.groupId;
  const role = payload.role as "editor" | "viewer";

  // No `kind` means this cookie was issued before the discriminated union
  // existed — every such cookie is a link session (member sessions didn't
  // exist yet), so treat it as one rather than forcing a logout on deploy.
  const kind = payload.kind ?? "link";

  if (kind === "link" && typeof payload.shareLinkId === "string") {
    return { kind: "link", groupId, role, shareLinkId: payload.shareLinkId };
  }
  if (kind === "member" && typeof payload.userId === "string" && typeof payload.membershipId === "string") {
    return {
      kind: "member",
      groupId,
      role,
      userId: payload.userId,
      membershipId: payload.membershipId,
    };
  }
  return null;
}

/** Signs a user-identity session payload into an opaque, tamper-evident cookie value. */
export function signUserSession(payload: UserSessionPayload): string {
  return signValue(payload);
}

export function verifyUserSession(cookieValue: string | undefined | null): UserSessionPayload | null {
  const payload = verifyValue(cookieValue) as Record<string, unknown> | null;
  if (!payload || typeof payload.userId !== "string") return null;
  return { userId: payload.userId };
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  // Secure cookies are rejected by browsers over plain http://localhost, so
  // this is relaxed outside production rather than always true.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // Long-lived: access is revoked by flipping revoked_at server-side (checked
  // on every request), not by cookie expiry.
  maxAge: 60 * 60 * 24 * 365,
};

// Same shape as the group-context cookie's options — the user-identity
// cookie is revoked by the user changing their password / logging out
// (which simply clears it), not by any server-side flag check per request.
export const USER_SESSION_COOKIE_OPTIONS = SESSION_COOKIE_OPTIONS;
