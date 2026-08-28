import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";

// The app-wide marketing/help header: a full-bleed forest band with the
// wordmark on the left and a slot of actions on the right, tidily aligned to
// the page's own content width. Used by the landing page and the tutorial so
// the two read as one product; pass `innerClassName` to match each page's
// max-width and horizontal padding.
export function SiteHeader({
  logoHref = "/",
  innerClassName = "max-w-[1000px] px-4 sm:px-6",
  left,
  children,
}: {
  /** Where the wordmark links. Pass null to render it inert (embedded views). */
  logoHref?: string | null;
  /** Controls the inner container's max-width + padding so the logo lines up
   * with the page body below. */
  innerClassName?: string;
  /** Replaces the wordmark on the left — e.g. a "← Back" link in the settle
   * flow, which has no logo of its own. */
  left?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const logo = (
    <Logo
      size={24}
      wordmarkClassName="text-[15px] [&>span:first-child]:text-cream [&>span:last-child]:text-mint sm:text-[16.5px]"
    />
  );
  return (
    <header className="bg-forest dark:bg-dark-card">
      <div
        className={cn(
          "mx-auto flex h-15 items-center justify-between gap-2 py-3.5",
          innerClassName,
        )}
      >
        {left !== undefined ? (
          <div className="min-w-0 shrink">{left}</div>
        ) : logoHref ? (
          <Link href={logoHref} className="shrink-0">
            {logo}
          </Link>
        ) : (
          <div className="shrink-0">{logo}</div>
        )}
        <div className="flex shrink-0 items-center gap-3 sm:gap-5">{children}</div>
      </div>
    </header>
  );
}

// The standard "← back" link for a SiteHeader `left` slot on the forest band.
export function HeaderBackLink({
  href,
  onClick,
  children,
}: {
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const className =
    "block truncate text-[13px] font-bold whitespace-nowrap text-cream/85 hover:text-cream";
  return href ? (
    <Link href={href} className={className}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}

// The standard "Log in" action for SiteHeader: a bordered pill on the forest
// band, identical at every width. Shared so every header stays consistent.
export function HeaderLoginLink() {
  return (
    <Link
      href="/login"
      className="flex h-[30px] shrink-0 items-center rounded-full border border-white/22 px-3.5 text-[12px] font-bold whitespace-nowrap text-cream transition-colors hover:bg-white/10"
    >
      Log in
    </Link>
  );
}
