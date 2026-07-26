"use client";

import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { GroupSwitcher } from "./GroupSwitcher";

interface GroupHeaderProps {
  groupId: string;
  groupName: string;
  actorType: "member" | "visitor";
}

// Shared nav header for every in-group screen (P3-02, P4-01, etc.): logo,
// group name, theme toggle. A visitor (anonymous, link-only) has no other
// group to switch to, so their center slot stays the plain text it always
// was (CLAUDE.md rule 5 — no per-viewer identity either way). A registered
// member gets GroupSwitcher instead — a way back to their other groups
// without leaving the one they're in (CR-2.md #1/#2).
export function GroupHeader({ groupId, groupName, actorType }: GroupHeaderProps) {
  return (
    <div className="mb-6 grid grid-cols-3 items-center sm:mb-[26px]">
      <Logo size={26} wordmarkClassName="text-base sm:text-[17px]" className="justify-self-start" />
      {actorType === "member" ? (
        <GroupSwitcher groupId={groupId} groupName={groupName} />
      ) : (
        <span className="min-w-0 truncate px-2 text-center text-[13.5px] font-bold text-ink dark:text-dark-text">
          {groupName}
        </span>
      )}
      <ThemeToggle className="justify-self-end" />
    </div>
  );
}
