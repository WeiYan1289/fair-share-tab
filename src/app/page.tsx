import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";
import { getCurrentUserId } from "@/lib/auth/require-user-session";
import { resolveActiveGroupId } from "@/lib/auth/require-session";

// Session-aware landing (session-persistence-and-ownership design §2/§3):
// a logged-in user always goes to their dashboard, even if they also hold
// a group-context session — the account is the durable identity, and the
// group stays one Back-press away. A visitor with only a valid group
// session goes straight to that group's events. Everyone else — including
// a visitor whose link was revoked — sees the marketing landing page.
//
// This makes "/" a dynamic route (it reads cookies), giving up static
// optimization for a page that was already tiny.
export default async function Home() {
  if (await getCurrentUserId()) {
    redirect("/account/groups");
  }

  const groupId = await resolveActiveGroupId();
  if (groupId) {
    redirect(`/g/${groupId}/events`);
  }

  return <Landing />;
}
