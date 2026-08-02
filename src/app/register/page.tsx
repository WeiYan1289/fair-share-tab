import { redirect } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { getCurrentUserId } from "@/lib/auth/require-user-session";

// Gated on login only, unlike "/" and "/login" -- a valid group session is
// deliberately NOT redirected away here. ShareDialog's "Own & regenerate"
// nudge and CreateGroupModal's capBlocked message both link here while the
// visitor holds a valid group session (that's the entire claim flow); a
// blanket group-session redirect would send them straight back into the
// group before they ever saw the form, breaking both features.
export default async function RegisterPage() {
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
        <RegisterForm />
      </div>
    </div>
  );
}
