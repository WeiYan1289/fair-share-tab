"use client";

import { ArchiveRestore } from "lucide-react";

interface RestoreButtonProps {
  /** Accessible name, e.g. "Restore Japan Trip 2025". Also the hover tooltip. */
  label: string;
  restoring: boolean;
  onClick: () => void;
}

// The only control on an archived row, shared by both archive screens so
// they stay one idiom. Icon-only below sm: the row already carries a name,
// a meta line and (for events) a total, and a full-width text button on a
// 375px screen pushed all of that onto a second line. The word "Restore"
// returns from sm up, where there is room for it.
//
// The icon is never the sole accessible name -- aria-label carries the row's
// subject at every width, so "Restore" alone is never ambiguous between rows
// to a screen reader. title gives sighted pointer users the same hint.
export function RestoreButton({ label, restoring, onClick }: RestoreButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={restoring}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-md border border-ink/14 bg-white text-ink disabled:cursor-default disabled:opacity-50 sm:h-auto sm:w-auto sm:gap-1.5 sm:px-3.5 sm:py-2 dark:border-white/14 dark:bg-dark-card dark:text-dark-text"
    >
      <ArchiveRestore className="h-4 w-4 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
      <span className="hidden text-[12.5px] font-bold whitespace-nowrap sm:inline">
        {restoring ? "Restoring…" : "Restore"}
      </span>
    </button>
  );
}
