import { redirect } from "next/navigation";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { JoinScreen } from "@/components/join/JoinScreen";

// Screen Spec P2-04. Server Component: reads the session set by the token
// exchange at /g/[groupId] and loads the data JoinScreen needs directly via
// Prisma (CLAUDE.md rule 7 — all DB access goes through server code).
export default async function JoinPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) redirect("/");
    throw error;
  }

  if (session.groupId !== groupId) redirect("/");

  const [group, shareLink] = await Promise.all([
    prisma.group.findUnique({
      where: { id: groupId },
      select: {
        name: true,
        members: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, avatarColor: true },
        },
      },
    }),
    prisma.groupShareLink.findUnique({
      where: { id: session.shareLinkId },
      select: { token: true },
    }),
  ]);

  if (!group || !shareLink) redirect("/");

  return (
    <JoinScreen
      groupId={groupId}
      groupName={group.name}
      members={group.members}
      shareToken={shareLink.token}
    />
  );
}
