import { after } from "next/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { hashPassword } from "@/lib/auth/password";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { hashResetToken } from "@/lib/auth/reset-token";
import { SESSION_COOKIE_NAME, USER_SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getMailer } from "@/lib/mail/mailer";
import { passwordChangedEmail } from "@/lib/mail/templates";
import { prisma } from "@/lib/prisma";
import { resetSchema } from "@/lib/validation/auth";

// One message for every failure mode -- unknown token, already used,
// expired. Distinguishing them would tell an attacker which guesses were
// structurally close, and tells a legitimate user nothing they can act on
// differently: in every case the answer is "request a new link".
const INVALID_TOKEN_MESSAGE = "This link is invalid or has expired — request a new one.";

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
  if (isRateLimited(`auth-reset:${ip}`)) {
    return new NextResponse("Too many attempts. Please try again in a minute.", { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = resetSchema.safeParse(body);
  // A malformed token never reaches the database: resetSchema pins the
  // exact length and alphabet, so guessing traffic is rejected here.
  if (!parsed.success) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }
  const { token, newPassword } = parsed.data;

  const tokenRow = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    include: { user: { select: { id: true, email: true } } },
  });

  const now = new Date();
  if (!tokenRow || tokenRow.usedAt !== null || tokenRow.expiresAt <= now) {
    return NextResponse.json({ error: INVALID_TOKEN_MESSAGE }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: tokenRow.userId },
      // passwordChangedAt is what evicts every session issued before now --
      // both fst_user_session and any member-kind fst_session.
      data: { passwordHash, passwordChangedAt: now },
    }),
    // Every outstanding token dies, not just the one used. A second reset
    // email from an earlier request must not still work afterwards.
    prisma.passwordResetToken.updateMany({
      where: { userId: tokenRow.userId, usedAt: null },
      data: { usedAt: now },
    }),
  ]);

  // The caller's own cookies are now stale and would be rejected on the
  // next request anyway; clearing them makes that immediate rather than
  // leaving the browser to present a dead session.
  const cookieStore = await cookies();
  cookieStore.delete(USER_SESSION_COOKIE_NAME);
  cookieStore.delete(SESSION_COOKIE_NAME);

  const email = passwordChangedEmail({ recipientEmail: tokenRow.user.email });
  after(async () => {
    try {
      await getMailer().send({ to: tokenRow.user.email, ...email });
    } catch (error) {
      // Never fails the reset: the password has already been changed, and
      // reporting an error here would suggest otherwise.
      console.error("Failed to send password-changed notification", error);
    }
  });

  // Deliberately no session is issued. Auto-login would mean the emailed
  // token itself mints a session, widening what a link leaked in transit
  // can do.
  return NextResponse.json({ message: "Password updated. Log in with your new password." });
}
