import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
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
      <div className="mx-auto max-w-[420px] px-6 py-10 sm:py-14">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/">
            <Logo size={24} wordmarkClassName="text-base" />
          </Link>
          <ThemeToggle />
        </div>
        <ForgotForm />
      </div>
    </div>
  );
}
