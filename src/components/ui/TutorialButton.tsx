"use client";

import Link from "next/link";
import { HelpCircle } from "lucide-react";

// Icon-only at every breakpoint — unlike Log out (which gains a text label
// on sm+), there's no natural short label for "how this app works" that's
// worth the extra header width, so this stays the same everywhere it's
// rendered: GroupHeader, MyGroupsView, SettleUpFlow's own headers.
// Links to the same /tutorial content used from the landing page, with
// ?embedded=1 telling TutorialView to drop the marketing chrome (Log in,
// Create group/account) and swap "Back home" for a real back-to-previous-page control.
export function TutorialButton() {
  return (
    <Link
      href="/tutorial?embedded=1"
      aria-label="How it works"
      title="How it works"
      className="flex h-7 w-7 items-center justify-center text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text"
    >
      <HelpCircle className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
