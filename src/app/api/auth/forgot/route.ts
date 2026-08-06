import { after } from "next/server";
import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { generateResetToken, hashResetToken, RESET_TOKEN_TTL_MINUTES } from "@/lib/auth/reset-token";
import { isResetRequestThrottled, RESET_DAILY_WINDOW_MS } from "@/lib/auth/reset-throttle";
import { getMailer } from "@/lib/mail/mailer";
import { buildResetUrl } from "@/lib/mail/reset-url";
import { resetPasswordEmail } from "@/lib/mail/templates";
import { prisma } from "@/lib/prisma";
import { forgotSchema } from "@/lib/validation/auth";

// Identical for a matched and an unmatched email. Anything that varies with
// whether the account exists -- body, status, or latency -- turns this
// endpoint into a user-enumeration oracle, which is why the send below is
// deferred with after() rather than awaited inline: awaiting it would make
// a match measurably slower than a miss.
const GENERIC_RESPONSE = {
  message: "If an account exists for that email, we've sent a reset link.",
};

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof CsrfError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  // First line only. This limiter is in-memory and per-instance, so it does
  // not survive serverless -- the per-account limits below are what this
  // endpoint's abuse resistance actually rests on.
  const ip = getClientIp(request);
  if (isRateLimited(`auth-forgot:${ip}`)) {
    return new NextResponse("Too many attempts. Please try again in a minute.", { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = forgotSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Built before the lookup, deliberately, so both branches perform exactly
  // the same work on the request path. Generating a token for an address
  // that turns out not to exist costs microseconds of CPU and no I/O, and
  // it keeps a matched request from being distinguishable by duration.
  // buildResetUrl also throws here if APP_URL is unset, which fails loudly
  // and equally for both branches rather than only for real accounts.
  const token = generateResetToken();
  const email = resetPasswordEmail({
    resetUrl: buildResetUrl(token),
    recipientEmail: parsed.data.email,
  });

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) {
    return NextResponse.json(GENERIC_RESPONSE);
  }

  // Everything from here is deferred past the response. The throttle read
  // and the token insert used to sit on the request path, which made a
  // matched request measurably slower than a miss -- the same enumeration
  // leak the generic body and the deferred send already close, arriving by
  // a different route.
  after(async () => {
    try {
      const now = new Date();
      const recentTokens = await prisma.passwordResetToken.findMany({
        where: {
          userId: user.id,
          createdAt: { gte: new Date(now.getTime() - RESET_DAILY_WINDOW_MS) },
        },
        select: { createdAt: true },
      });

      // Throttled requests simply produce nothing. The caller already
      // received the same response either way, so there is nothing to
      // return here -- which is the point.
      if (isResetRequestThrottled({ now, tokenCreatedAts: recentTokens.map((t) => t.createdAt) })) {
        return;
      }

      await prisma.$transaction([
        // Opportunistic cleanup instead of a cron: spent tokens outside the
        // rate-limit window have no further use, and this is the only moment
        // we are already writing for this user.
        prisma.passwordResetToken.deleteMany({
          where: {
            userId: user.id,
            createdAt: { lt: new Date(now.getTime() - RESET_DAILY_WINDOW_MS) },
          },
        }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashResetToken(token),
            expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60 * 1000),
          },
        }),
      ]);

      await getMailer().send({ to: user.email, ...email });
    } catch (error) {
      // The response has already gone out, so this cannot surface to the
      // caller -- and must not, since a failure here is exactly the kind of
      // difference that would distinguish a real account from a miss.
      console.error("Failed to issue password reset email", error);
    }
  });

  return NextResponse.json(GENERIC_RESPONSE);
}
