import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// Named [token] rather than [groupId]: this route only ever receives a raw
// share token (GET /g/{token}, system-design.md §3.2), never a group id. When
// Step 8 adds real pages under /g/[groupId]/..., this folder must be renamed
// to match — Next.js requires one dynamic segment name per route position.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const ip = getClientIp(request);
  if (isRateLimited(`token-lookup:${ip}`)) {
    return new NextResponse("Too many attempts. Please try again in a minute.", { status: 429 });
  }

  const link = await prisma.groupShareLink.findUnique({ where: { token } });

  // Same response for "never existed" and "revoked" — copy stays generic on
  // purpose (Screen Spec P2-05).
  if (!link || link.revokedAt !== null) {
    return new NextResponse("This link is invalid or has been revoked.", {
      status: 404,
      headers: { "X-Robots-Tag": "noindex" },
    });
  }

  const session = signSession({ groupId: link.groupId, role: link.role, shareLinkId: link.id });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session, SESSION_COOKIE_OPTIONS);

  // Clean redirect so the raw token never sits in the address bar
  // (system-design.md §3.3).
  const destination = new URL(`/g/${link.groupId}/events`, request.url);
  return NextResponse.redirect(destination, { status: 303 });
}
