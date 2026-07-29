import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { generateShareToken } from "@/lib/auth/token";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth/session";
import {
  VISITOR_CAP_COOKIE_NAME,
  VISITOR_CAP_COOKIE_OPTIONS,
  signVisitorCapCookie,
  verifyVisitorCapCookie,
} from "@/lib/auth/visitor-cap";
import { assignAvatarColor } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { createGroupSchema } from "@/lib/validation/group";

// The anonymous "Landing -> Create group" flow only (system-design.md §6.1) —
// always creates a pure visitor/link-owned group, capped at one per visitor
// via a signed, best-effort device cookie (system-design.md §3.3). This is
// the only unauthenticated write route in the app, so it also gets its own
// rate limit.
//
// Deliberately ignores any fst_user_session cookie that happens to be
// present. This route used to also attach the group to whatever account
// that cookie named, which meant a browser that merely still held an old,
// unrevoked login (fst_user_session has no server-side revocation — see
// require-user-session.ts) got its "anonymous" group silently and
// permanently tied to that account, with no indication anywhere in the UI
// that it had happened (the landing page has no session-aware UI at all,
// and the session cookie minted below is still kind:"link", so the group
// itself looks and behaves like a visitor's right up until the account
// holder later finds it sitting in /account/groups). A logged-in member
// creating an additional group is a distinct, deliberate action and goes
// through POST /api/account/groups instead, which requires and reads that
// session explicitly rather than inferring it from ambient cookie state.
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
  if (isRateLimited(`groups-create:${ip}`)) {
    return new NextResponse("Too many attempts. Please try again in a minute.", { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, creatorName } = parsed.data;

  const cookieStore = await cookies();
  const existingCap = verifyVisitorCapCookie(cookieStore.get(VISITOR_CAP_COOKIE_NAME)?.value);
  if (existingCap) {
    return NextResponse.json(
      {
        error: "You've already created one group as a guest. Create a free account to make more.",
      },
      { status: 403 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({ data: { name } });

    const creator = await tx.member.create({
      data: {
        groupId: group.id,
        name: creatorName,
        avatarColor: assignAvatarColor(),
      },
    });

    const shareLink = await tx.groupShareLink.create({
      data: { groupId: group.id, token: generateShareToken(), role: "editor" },
    });

    return { group, creator, shareLink };
  });

  const session = signSession({
    kind: "link",
    groupId: result.group.id,
    role: "editor",
    shareLinkId: result.shareLink.id,
  });
  cookieStore.set(SESSION_COOKIE_NAME, session, SESSION_COOKIE_OPTIONS);

  const cap = signVisitorCapCookie({ groupId: result.group.id, memberId: result.creator.id });
  cookieStore.set(VISITOR_CAP_COOKIE_NAME, cap, VISITOR_CAP_COOKIE_OPTIONS);

  return NextResponse.json(
    {
      group: { id: result.group.id, name: result.group.name },
      creatorMemberId: result.creator.id,
      creatorAvatarColor: result.creator.avatarColor,
      shareLink: { token: result.shareLink.token, role: result.shareLink.role },
    },
    { status: 201 },
  );
}
