import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { claimVisitorGroup } from "@/lib/auth/claim";
import { hashPassword } from "@/lib/auth/password";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  USER_SESSION_COOKIE_NAME,
  USER_SESSION_COOKIE_OPTIONS,
  signSession,
  signUserSession,
} from "@/lib/auth/session";
import { VISITOR_CAP_COOKIE_NAME, verifyVisitorCapCookie } from "@/lib/auth/visitor-cap";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/auth";

// Creates a user. If the request carries a valid fst_visitor_created_group
// cookie (set by POST /api/groups on an anonymous group creation), the
// referenced group is claimed into the new account in the same transaction
// — "claim on register" (data-model.md §9). A missing/invalid/already-used
// cookie is not an error: registration just proceeds with zero groups.
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const ip = getClientIp(request);
  if (isRateLimited(`auth-register:${ip}`)) {
    return new NextResponse("Too many attempts. Please try again in a minute.", { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const passwordHash = await hashPassword(password);
  const cookieStore = await cookies();
  const cap = verifyVisitorCapCookie(cookieStore.get(VISITOR_CAP_COOKIE_NAME)?.value);

  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { email, passwordHash } });

      const claim = cap
        ? await claimVisitorGroup(tx, { memberId: cap.memberId, groupId: cap.groupId, userId: user.id })
        : { claimed: false as const };

      return { user, claim };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    throw error;
  }

  cookieStore.set(USER_SESSION_COOKIE_NAME, signUserSession({ userId: result.user.id }), USER_SESSION_COOKIE_OPTIONS);
  cookieStore.delete(VISITOR_CAP_COOKIE_NAME);

  if (result.claim.claimed && cap && result.claim.membershipId) {
    const memberSession = signSession({
      kind: "member",
      groupId: cap.groupId,
      role: "editor",
      userId: result.user.id,
      membershipId: result.claim.membershipId,
    });
    cookieStore.set(SESSION_COOKIE_NAME, memberSession, SESSION_COOKIE_OPTIONS);
  }

  return NextResponse.json(
    {
      user: { id: result.user.id, email: result.user.email },
      claimedGroupId: result.claim.claimed ? cap?.groupId : null,
    },
    { status: 201 },
  );
}
