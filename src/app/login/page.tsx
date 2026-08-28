import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUserId } from "@/lib/auth/require-user-session";
import { resolveActiveGroupId } from "@/lib/auth/require-session";

// Same session-aware gate as the homepage (session-persistence-and-ownership
// design §2/§3): a page for signing in has no reason to exist for someone
// already signed in, or already sitting inside a group. Same precedence —
// account wins when both are present.
export default async function LoginPage() {
  if (await getCurrentUserId()) {
    redirect("/account/groups");
  }

  const groupId = await resolveActiveGroupId();
  if (groupId) {
    redirect(`/g/${groupId}/events`);
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      <SiteHeader innerClassName="max-w-[420px] px-6">
        <ThemeToggle />
      </SiteHeader>
      <div className="mx-auto max-w-[420px] px-6 py-10 sm:py-14">
        <LoginForm />
      </div>
    </div>
  );
}
