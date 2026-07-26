import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth/require-user-session";
import { prisma } from "@/lib/prisma";

// Convenience endpoint for client-side auth-state checks (e.g. nav "Log in"
// vs account menu). Returns 401 rather than null on the happy-empty path so
// callers can't confuse "not logged in" with a slow/failed request.
export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  return NextResponse.json({ user });
}
