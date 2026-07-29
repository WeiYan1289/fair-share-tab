import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { SessionError } from "@/lib/auth/require-session";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth/session";
import { generateShareToken } from "@/lib/auth/token";
import { listUserGroups } from "@/lib/account";
import { assignAvatarColor } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { createGroupSchema } from "@/lib/validation/group";

export async function GET() {
  let session;
  try {
    session = await requireUserSession();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const groups = await listUserGroups(session.userId);
  return NextResponse.json({ groups });
}

// The counterpart to POST /api/groups (the anonymous flow): a logged-in
// member deliberately creating an additional group from their own dashboard
// (GroupSwitcher, MyGroupsView). Requires fst_user_session explicitly rather
// than reading it opportunistically, and — unlike the anonymous route —
// mints a kind:"member" session for the new group (matching
// .../[groupId]/enter), not kind:"link", so the group's own UI immediately
// shows this account as a member (logout, email, switcher) instead of
// looking like a visitor's group.
export async function POST(request: Request) {
  let session;
  try {
    assertSameOrigin(request);
    session = await requireUserSession();
  } catch (error) {
    if (error instanceof CsrfError || error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, creatorName } = parsed.data;
  const { userId } = session;

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({ data: { name } });

    const creator = await tx.member.create({
      data: {
        groupId: group.id,
        name: creatorName,
        avatarColor: assignAvatarColor(),
        userId,
      },
    });

    const shareLink = await tx.groupShareLink.create({
      data: { groupId: group.id, token: generateShareToken(), role: "editor" },
    });

    const membership = await tx.groupMembership.create({
      data: { groupId: group.id, userId, role: "editor" },
    });

    return { group, creator, shareLink, membership };
  });

  const groupSession = signSession({
    kind: "member",
    groupId: result.group.id,
    role: "editor",
    userId,
    membershipId: result.membership.id,
  });
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, groupSession, SESSION_COOKIE_OPTIONS);

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
