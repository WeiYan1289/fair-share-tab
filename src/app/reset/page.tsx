import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";
import { ResetForm } from "@/components/auth/ResetForm";

// No session gate and no server-side token validation. The token is checked
// on submit instead: there is no session to protect here, and reporting
// "invalid token" before submission tells an attacker nothing the flow's
// existence doesn't already. A logged-in visitor is not redirected either --
// arriving here with a valid link is exactly what someone does when they
// suspect the session they hold isn't only theirs.
export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      <div className="mx-auto max-w-[420px] px-6 py-10 sm:py-14">
        <div className="mb-10 flex items-center justify-between">
          <Link href="/">
            <Logo size={24} wordmarkClassName="text-base" />
          </Link>
          <ThemeToggle />
        </div>

        {token ? (
          <ResetForm token={token} />
        ) : (
          <div className="rounded-lg bg-white p-7 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)] sm:p-8 dark:bg-dark-card">
            <h1 className="num mb-1.5 text-[22px] text-ink dark:text-dark-text">
              This link is incomplete
            </h1>
            <p className="mb-6 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
              Reset links sometimes get cut short by email clients. Request a new one and open it
              directly from the email.
            </p>
            <Link href="/forgot">
              <Button variant="primary" className="w-full text-center">
                Request a new link
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
