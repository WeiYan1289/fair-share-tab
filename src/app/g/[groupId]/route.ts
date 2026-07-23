import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// This route matches GET /g/{token} (system-design.md §3.2) — the segment
// holds a raw share token here, not a group id, even though the folder is
// named [groupId] to match every nested page under it (/g/[groupId]/join,
// /g/[groupId]/events, ...). Next.js requires one dynamic segment name per
// route-tree position, so this top-level handler and its siblings share the
// folder; only this handler's value is actually a token.
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

  // Clean redirect so the raw token never sits in the address bar
  // (system-design.md §3.3). Always lands on the join screen — whether this
  // device can skip straight to the events list (already claimed a member
  // here before) is a client-side decision the join page makes by reading
  // its own local storage (Screen Spec P2-04 notes), not something the
  // server can know from the session alone.
  const destination = new URL(`/g/${link.groupId}/join`, request.url);
  return NextResponse.redirect(destination, { status: 303 });
}
