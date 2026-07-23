import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { generateShareToken } from "@/lib/auth/token";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth/session";
import { assignAvatarColor } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { createGroupSchema } from "@/lib/validation/group";

// Creates a group, its first member (the creator), and an editor share link
// in one transaction (system-design.md §5, §6.1). creatorName is required so
// the owner is never left as an unnamed member (data-model.md §7).
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { name, currency, creatorName } = parsed.data;

  const result = await prisma.$transaction(async (tx) => {
    const group = await tx.group.create({ data: { name, currency } });

    const creator = await tx.member.create({
      data: { groupId: group.id, name: creatorName, avatarColor: assignAvatarColor() },
    });

    const shareLink = await tx.groupShareLink.create({
      data: { groupId: group.id, token: generateShareToken(), role: "editor" },
    });

    return { group, creator, shareLink };
  });

  const session = signSession({
    groupId: result.group.id,
    role: "editor",
    shareLinkId: result.shareLink.id,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session, SESSION_COOKIE_OPTIONS);

  return NextResponse.json(
    {
      group: { id: result.group.id, name: result.group.name, currency: result.group.currency },
      creatorMemberId: result.creator.id,
      shareLink: { token: result.shareLink.token, role: result.shareLink.role },
    },
    { status: 201 },
  );
}
