"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { dedupedFetchJson } from "@/lib/dedupe-fetch";
import { cn } from "@/lib/cn";

// `forest` recolours for GroupHeader's forest band; `light` (default) keeps
// the muted-on-cream look the settle-flow headers use.
type HeaderTone = "light" | "forest";

// Every in-group page (events list, event dashboard, settle-up, member
// screens) shows this, but until now only /account/groups itself showed
// the signed-in email and a way to log out -- so a registered member
// browsing inside a group had no visible sign they were logged in at all.
// Fetches its own state client-side (mirroring GroupSwitcher's lazy
// group-list fetch) so callers don't all need to plumb the user's email
// down as a prop.
//
// Self-responsive rather than taking an iconOnly prop: on mobile, where
// every pixel in the header is contested, Log out is an icon alone; on
// sm+ there's room for the full email + text button. One component adapts
// everywhere it's used, including SettleUpFlow's header, which doesn't go
// through GroupHeader at all.
export function MemberAccountControls({ tone = "light" }: { tone?: HeaderTone }) {
  const forest = tone === "forest";
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    dedupedFetchJson<{ user: { email: string } }>("/api/auth/me").then((data) => {
      if (!cancelled && data) setEmail(data.user.email);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {email && (
        <span
          className={cn(
            "hidden max-w-[160px] truncate text-[12px] sm:inline",
            forest ? "text-cream/70" : "text-muted dark:text-dark-muted",
          )}
        >
          {email}
        </span>
      )}
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Log out"
        title="Log out"
        className={cn(
          "flex h-7 w-7 items-center justify-center sm:hidden",
          forest
            ? "text-cream/80 hover:text-cream"
            : "text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text",
        )}
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={handleLogout}
        className={cn(
          "hidden text-[12px] font-bold sm:inline",
          forest
            ? "text-cream/85 hover:text-cream"
            : "text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text",
        )}
      >
        Log out
      </button>
    </div>
  );
}
