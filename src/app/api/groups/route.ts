import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { generateShareToken } from "@/lib/auth/token";
import { getCurrentUserId } from "@/lib/auth/require-user-session";
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

// Creates a group, its first member (the creator), and an editor share link
// in one transaction (system-design.md §5, §6.1). creatorName is required so
// the owner is never left as an unnamed member (data-model.md §7).
//
// A logged-in caller may create any number of groups (a GroupMembership is
// added alongside the usual rows). An anonymous caller is capped at one
// group, enforced by a signed, best-effort device cookie (system-design.md
// §3.3) — this is the only unauthenticated write route in the app, so it
// also gets its own rate limit now that it has more to abuse.
export async function POST(request: Request) {
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

  const userId = await getCurrentUserId();
  const cookieStore = await cookies();

  if (!userId) {
    const existingCap = verifyVisitorCapCookie(cookieStore.get(VISITOR_CAP_COOKIE_NAME)?.value);
    if (existingCap) {
      return NextResponse.json(
        {
          error:
            "You've already created one group as a guest. Create a free account to make more.",
        },
        { status: 403 },
      );
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({ data: { name } });

    const creator = await tx.member.create({
      data: {
        groupId: group.id,
        name: creatorName,
        avatarColor: assignAvatarColor(),
        ...(userId ? { userId } : {}),
      },
    });

    const shareLink = await tx.groupShareLink.create({
      data: { groupId: group.id, token: generateShareToken(), role: "editor" },
    });

    if (userId) {
      await tx.groupMembership.create({
        data: { groupId: group.id, userId, role: "editor" },
      });
    }

    return { group, creator, shareLink };
  });

  const session = signSession({
    kind: "link",
    groupId: result.group.id,
    role: "editor",
    shareLinkId: result.shareLink.id,
  });
  cookieStore.set(SESSION_COOKIE_NAME, session, SESSION_COOKIE_OPTIONS);

  if (!userId) {
    const cap = signVisitorCapCookie({ groupId: result.group.id, memberId: result.creator.id });
    cookieStore.set(VISITOR_CAP_COOKIE_NAME, cap, VISITOR_CAP_COOKIE_OPTIONS);
  }

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
