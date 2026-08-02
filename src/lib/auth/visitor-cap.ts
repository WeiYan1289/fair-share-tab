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

/**
 * The predicate behind GET /api/groups/{id}/context's `canClaim` field
 * (session-persistence-and-ownership design §5, "The registration nudge,
 * and who sees it"): true only when the group has no owner yet AND the
 * caller's signed visitor-cap cookie names this exact group — i.e. only
 * for the specific guest who created it, on the device they created it
 * from. A cap for a different group, or no cap at all, never qualifies,
 * because claimVisitorGroup can never act on either.
 */
export function computeCanClaim(params: {
  hasOwner: boolean;
  cap: VisitorCapPayload | null;
  groupId: string;
}): boolean {
  return !params.hasOwner && params.cap !== null && params.cap.groupId === params.groupId;
}
