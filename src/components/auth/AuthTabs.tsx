import Link from "next/link";
import { cn } from "@/lib/cn";

interface AuthTabsProps {
  active: "login" | "register";
}

// Segmented control at the top of the login/register card so switching
// modes doesn't rely on spotting a sentence at the bottom of the form
// (CR-2.md follow-up). Reuses the equal/custom split-method toggle pattern
// from BillForm.tsx — same track, same active-pill treatment — so this
// reads as the app's one switcher idiom, not a one-off. The dark-mode
// track color differs from BillForm's, though: that toggle sits directly
// on the page background (dark-bg), so dark-card reads as a raised track;
// this one is nested inside a dark-card auth card, so it uses dark-bg
// instead to read as a recessed groove — same relationship, different
// literal token, because the surrounding surface is different.
//
// These are links, not ARIA tabs, despite looking like a segmented
// control. The ARIA tabs pattern describes swapping panels within one
// page; /login and /register are separate routes, so role="tab" would
// announce "tab" to a screen reader and then navigate the whole document
// out from under it. Links also restore middle-click and open-in-new-tab,
// which buttons calling router.push() silently broke.
export function AuthTabs({ active }: AuthTabsProps) {
  const itemClass = (isActive: boolean) =>
    cn(
      "flex-1 rounded-[10px] py-2.5 text-center text-[13.5px] font-bold transition-colors",
      isActive
        ? "bg-forest text-cream dark:bg-dark-forest"
        : "text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text",
    );

  return (
    <div className="mb-6 flex gap-1 rounded-md bg-app-bg p-1 dark:bg-dark-bg">
      <Link
        href="/login"
        aria-current={active === "login" ? "page" : undefined}
        className={itemClass(active === "login")}
      >
        Log in
      </Link>
      <Link
        href="/register"
        aria-current={active === "register" ? "page" : undefined}
        className={itemClass(active === "register")}
      >
        Create account
      </Link>
    </div>
  );
}
