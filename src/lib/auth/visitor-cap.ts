import { signValue, verifyValue } from "./session";

export const VISITOR_CAP_COOKIE_NAME = "fst_visitor_created_group";

export interface VisitorCapPayload {
  groupId: string;
  memberId: string;
}

// Same long lifetime as the group-context session (session.ts) — the cap is
// meant to hold for as long as someone might plausibly come back and
// register, not just for one browsing session.
export const VISITOR_CAP_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/**
 * Signed so the cap can't become an integrity issue: the cap itself is
 * explicitly soft/best-effort (clearing cookies resets it — see
 * system-design.md §3.3), but an *unsigned* value would let someone
 * hand-edit `memberId` to claim an arbitrary member into their new account
 * on register. Signing closes that gap for free by reusing session.ts's
 * HMAC primitives.
 */
export function signVisitorCapCookie(payload: VisitorCapPayload): string {
  return signValue(payload);
}

export function verifyVisitorCapCookie(cookieValue: string | undefined | null): VisitorCapPayload | null {
  const payload = verifyValue(cookieValue) as Record<string, unknown> | null;
  if (!payload || typeof payload.groupId !== "string" || typeof payload.memberId !== "string") {
    return null;
  }
  return { groupId: payload.groupId, memberId: payload.memberId };
}
