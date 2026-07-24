"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { cn } from "@/lib/cn";

interface ThemeToggleProps {
  className?: string;
}

// One control, present on every screen, that is the only thing allowed to
// change light/dark -- replaces the old per-screen mix of OS-driven
// `prefers-color-scheme` (on the dashboard and settle-up graph only) and
// screens with no dark treatment at all, which is what made the app flip
// modes inconsistently between screens.
export function ThemeToggle({ className }: ThemeToggleProps) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink/14 bg-white text-ink transition-colors hover:bg-cream-hover dark:border-white/14 dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-bg",
        className,
      )}
    >
      {theme === null ? null : theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 2v2.5" />
            <path d="M12 19.5V22" />
            <path d="M4.2 4.2l1.8 1.8" />
            <path d="M18 18l1.8 1.8" />
            <path d="M2 12h2.5" />
            <path d="M19.5 12H22" />
            <path d="M4.2 19.8l1.8-1.8" />
            <path d="M18 6l1.8-1.8" />
          </g>
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
}
