import { NextResponse } from "next/server";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { prisma } from "@/lib/prisma";
import { claimMemberSchema } from "@/lib/validation/group";

// Validates that a memberId belongs to this group. The actual "claim" is
// stored client-side only (data-model.md §4) — this endpoint just confirms
// the choice is legitimate before the client persists it as personalisation,
// never authorisation.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: groupId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  if (session.groupId !== groupId) {
    return NextResponse.json({ error: "Session does not match this group" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = claimMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const member = await prisma.member.findFirst({
    where: { id: parsed.data.memberId, groupId, isActive: true },
  });

  if (!member) {
    return NextResponse.json({ error: "Member not found in this group" }, { status: 404 });
  }

  return NextResponse.json({ memberId: member.id, name: member.name });
}
