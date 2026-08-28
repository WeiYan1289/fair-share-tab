"use client";

import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { cn } from "@/lib/cn";
import { GroupSwitcher } from "./GroupSwitcher";
import { MemberAccountControls } from "./MemberAccountControls";
import { ExitGroupButton } from "./ExitGroupButton";
import { GroupOwnerBadge } from "./GroupOwnerBadge";

interface GroupHeaderProps {
  groupId: string;
  groupName: string;
  actorType: "member" | "visitor";
  /** The band's inner width + padding. Defaults to a generous width so the
   * group name, account controls and toggle get room on every page — the
   * narrow member/archived views were cramping the header otherwise. */
  contentClassName?: string;
}

// Shared nav header for every in-group screen (P3-02, P4-01, etc.). Rendered
// as a full-bleed forest band so it matches the marketing/auth/account
// SiteHeader — one header idiom across the whole app. Each consuming page
// renders it above its content container and passes that container's width
// via `contentClassName` so the logo lines up with the body.
//
// The controls are unchanged in behaviour and organisation — only recoloured
// for the forest band (`tone="forest"`). A visitor (anonymous, link-only) has
// no other group to switch to and no account to log out of, so their center
// slot stays plain text and their right slot is Exit group; a registered
// member gets GroupSwitcher + MemberAccountControls instead.
//
// Two layouts, not one flexed to fit both: on mobile there's no room for the
// logo alongside the group name/switcher and controls, so it's dropped and
// the switcher moves to the left edge; sm+ keeps the logo and centers the
// switcher between it and the controls.
export function GroupHeader({
  groupId,
  groupName,
  actorType,
  contentClassName = "max-w-[1600px] px-6 sm:px-10",
}: GroupHeaderProps) {
  return (
    <header className="bg-forest dark:bg-dark-card">
      <div className={cn("mx-auto", contentClassName)}>
        {/* Mobile: no logo, switcher/name flush left */}
        <div className="flex h-15 items-center justify-between gap-2 py-3 sm:hidden">
          <div className="min-w-0 flex-1">
            {actorType === "member" ? (
              <GroupSwitcher groupId={groupId} groupName={groupName} tone="forest" />
            ) : (
              <span className="block truncate px-1 text-[13.5px] font-bold text-cream">
                {groupName}
              </span>
            )}
            <div className="px-1">
              <GroupOwnerBadge groupId={groupId} tone="forest" />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {actorType === "member" ? (
              <MemberAccountControls tone="forest" />
            ) : (
              <ExitGroupButton tone="forest" />
            )}
            <TutorialButton className="text-cream/80 hover:text-cream dark:text-cream/80 dark:hover:text-cream" />
            <ThemeToggle />
          </div>
        </div>

        {/* Desktop: logo + centered switcher/name + full controls */}
        <div className="hidden h-15 grid-cols-3 items-center py-3 sm:grid">
          <Logo
            size={24}
            wordmarkClassName="text-[16.5px] [&>span:first-child]:text-cream [&>span:last-child]:text-mint"
            className="justify-self-start"
          />
          <div className="min-w-0 justify-self-center text-center">
            {actorType === "member" ? (
              <GroupSwitcher groupId={groupId} groupName={groupName} tone="forest" />
            ) : (
              <span className="block min-w-0 truncate px-2 text-center text-[13.5px] font-bold text-cream">
                {groupName}
              </span>
            )}
            <GroupOwnerBadge groupId={groupId} tone="forest" />
          </div>
          <div className="flex items-center justify-self-end gap-3 sm:gap-4">
            {actorType === "member" ? (
              <MemberAccountControls tone="forest" />
            ) : (
              <ExitGroupButton tone="forest" />
            )}
            <TutorialButton className="text-cream/80 hover:text-cream dark:text-cream/80 dark:hover:text-cream" />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
