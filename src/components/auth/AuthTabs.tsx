"use client";

import { useRouter } from "next/navigation";
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
// literal token, because the surrounding surface is different. /login and
// /register stay real, distinct, bookmarkable routes; a tab click is a
// plain client-side navigation between them, not a mode flag.
export function AuthTabs({ active }: AuthTabsProps) {
  const router = useRouter();

  return (
    <div className="mb-6 flex gap-1 rounded-md bg-app-bg p-1 dark:bg-dark-bg" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={active === "login"}
        onClick={() => router.push("/login")}
        className={cn(
          "flex-1 rounded-[10px] py-2.5 text-[13.5px] font-bold transition-colors",
          active === "login"
            ? "bg-forest text-cream dark:bg-dark-forest"
            : "text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text",
        )}
      >
        Log in
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "register"}
        onClick={() => router.push("/register")}
        className={cn(
          "flex-1 rounded-[10px] py-2.5 text-[13.5px] font-bold transition-colors",
          active === "register"
            ? "bg-forest text-cream dark:bg-dark-forest"
            : "text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text",
        )}
      >
        Create account
      </button>
    </div>
  );
}
