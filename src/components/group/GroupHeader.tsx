"use client";

import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface GroupHeaderProps {
  groupName: string;
}

// Shared nav header for every in-group screen (P3-02, P4-01, etc.): logo,
// group name, theme toggle. No per-viewer identity is tracked (CLAUDE.md
// rule 5) and there's no device-scoped group switcher anymore (access is
// purely link-driven), so there's nothing else to render here.
export function GroupHeader({ groupName }: GroupHeaderProps) {
  return (
    <div className="mb-6 grid grid-cols-3 items-center sm:mb-[26px]">
      <Logo size={26} wordmarkClassName="text-base sm:text-[17px]" className="justify-self-start" />
      <span
        className="min-w-0 truncate px-2 text-center text-[13.5px] font-bold text-ink dark:text-dark-text"
      >
        {groupName}
      </span>
      <ThemeToggle className="justify-self-end" />
    </div>
  );
}
