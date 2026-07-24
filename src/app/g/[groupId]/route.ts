import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// This route matches GET /g/{token} (system-design.md §3.2) — the segment
// holds a raw share token here, not a group id, even though the folder is
// named [groupId] to match every nested page under it (/g/[groupId]/events,
// ...). Next.js requires one dynamic segment name per route-tree position,
// so this top-level handler and its siblings share the folder; only this
// handler's value is actually a token.
export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId: token } = await params;

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

  // Access is granted purely by the cookie above — there's no separate
  // identity step to land on first. `savelink` carries the token forward
  // exactly one hop so the events list can offer a one-time "save this
  // link" reminder; it reads the param and strips it from the URL in the
  // same render pass (CLAUDE.md rule 8 — the token must never sit
  // persistently in the address bar).
  const destination = new URL(`/g/${link.groupId}/events?savelink=${token}`, request.url);
  return NextResponse.redirect(destination, { status: 303 });
}
