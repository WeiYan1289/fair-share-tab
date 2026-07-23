import { createHmac, timingSafeEqual } from "crypto";

export const SESSION_COOKIE_NAME = "fst_session";

export interface SessionPayload {
  groupId: string;
  role: "editor" | "viewer";
  shareLinkId: string;
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

/** Signs a session payload into an opaque, tamper-evident cookie value. */
export function signSession(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/**
 * Verifies a cookie value's HMAC signature and shape. Does NOT check
 * revocation — callers must re-check `group_share_link.revoked_at` against
 * the database on every request (system-design.md §8 "Revoked link
 * mid-session"). See requireSession in require-session.ts.
 */
export function verifySession(cookieValue: string | undefined | null): SessionPayload | null {
  if (!cookieValue) return null;

  const [body, signature] = cookieValue.split(".");
  if (!body || !signature) return null;

  const expected = sign(body);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const roleValid = payload?.role === "editor" || payload?.role === "viewer";
    if (typeof payload?.groupId === "string" && typeof payload?.shareLinkId === "string" && roleValid) {
      return payload as SessionPayload;
    }
    return null;
  } catch {
    return null;
  }
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
