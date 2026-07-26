import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDummyHash, verifyPassword } from "@/lib/auth/password";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { USER_SESSION_COOKIE_NAME, USER_SESSION_COOKIE_OPTIONS, signUserSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";

// Generic "Invalid email or password" for both a nonexistent email and a
// wrong password, and verifyPassword still runs (against a dummy hash) on
// the nonexistent-email path — both to avoid a user-enumeration timing side
// channel (system-design.md §3.3).
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (isRateLimited(`auth-login:${ip}`)) {
    return new NextResponse("Too many attempts. Please try again in a minute.", { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  const hashToCheck = user?.passwordHash ?? (await getDummyHash());
  const valid = await verifyPassword(hashToCheck, password);

  if (!user || !valid) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(USER_SESSION_COOKIE_NAME, signUserSession({ userId: user.id }), USER_SESSION_COOKIE_OPTIONS);

  return NextResponse.json({ user: { id: user.id, email: user.email } });
}
