import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SiteHeader } from "@/components/ui/SiteHeader";
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
      <SiteHeader innerClassName="max-w-[420px] px-6">
        <ThemeToggle />
      </SiteHeader>
      <div className="mx-auto max-w-[420px] px-6 py-10 sm:py-14">
        <RegisterForm />
      </div>
    </div>
  );
}
