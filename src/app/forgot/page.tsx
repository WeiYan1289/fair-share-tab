import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { ForgotForm } from "@/components/auth/ForgotForm";
import { getCurrentUserId } from "@/lib/auth/require-user-session";

// Same "don't show a page that has nothing to offer" gate /login applies,
// but only on the account signal: someone already signed in has no use for
// a reset link. A group session is deliberately not a redirect here --
// a visitor holding a group link may still be the owner of a separate
// account they've been locked out of.
export default async function ForgotPage() {
  if (await getCurrentUserId()) {
    redirect("/account/groups");
  }

  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      <SiteHeader innerClassName="max-w-[420px] px-6">
        <ThemeToggle />
      </SiteHeader>
      <div className="mx-auto max-w-[420px] px-6 py-10 sm:py-14">
        <ForgotForm />
      </div>
    </div>
  );
}
