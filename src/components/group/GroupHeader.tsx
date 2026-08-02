"use client";

import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { GroupSwitcher } from "./GroupSwitcher";
import { MemberAccountControls } from "./MemberAccountControls";
import { ExitGroupButton } from "./ExitGroupButton";
import { GroupOwnerBadge } from "./GroupOwnerBadge";

interface GroupHeaderProps {
  groupId: string;
  groupName: string;
  actorType: "member" | "visitor";
}

// Shared nav header for every in-group screen (P3-02, P4-01, etc.).
// A visitor (anonymous, link-only) has no other group to switch to and no
// account to log out of, so their center slot stays the plain text it
// always was (CLAUDE.md rule 5 — no per-viewer identity either way). A
// registered member gets GroupSwitcher instead — a way back to their other
// groups without leaving the one they're in — plus MemberAccountControls
// (email + Log out) so a member's signed-in state is visible on every
// in-group page, not just /account/groups. Getting back to the full group
// list is a "<- All groups" breadcrumb on the events list itself (matching
// the "<- All events" convention already used from the event dashboard),
// not a control repeated in this header on every page.
//
// Two full layouts, not one flexed to fit both: on mobile there's no room
// for the logo alongside the group name/switcher and controls, so it's
// dropped entirely and the switcher moves to the left edge where the logo
// used to be; sm+ keeps the logo and centers the switcher between it and
// the controls.
export function GroupHeader({ groupId, groupName, actorType }: GroupHeaderProps) {
  return (
    <>
      {/* Mobile: no logo, switcher/name flush left */}
      <div className="mb-6 flex items-center justify-between gap-2 sm:hidden">
        <div className="min-w-0 flex-1">
          {actorType === "member" ? (
            <GroupSwitcher groupId={groupId} groupName={groupName} />
          ) : (
            <span className="block truncate px-1 text-[13.5px] font-bold text-ink dark:text-dark-text">
              {groupName}
            </span>
          )}
          <div className="px-1">
            <GroupOwnerBadge groupId={groupId} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actorType === "member" ? <MemberAccountControls /> : <ExitGroupButton />}
          <TutorialButton />
          <ThemeToggle />
        </div>
      </div>

      {/* Desktop: logo + centered switcher/name + full controls */}
      <div className="mb-[26px] hidden grid-cols-3 items-center sm:grid">
        <Logo size={26} wordmarkClassName="text-[17px]" className="justify-self-start" />
        <div className="min-w-0 justify-self-center text-center">
          {actorType === "member" ? (
            <GroupSwitcher groupId={groupId} groupName={groupName} />
          ) : (
            <span className="block min-w-0 truncate px-2 text-center text-[13.5px] font-bold text-ink dark:text-dark-text">
              {groupName}
            </span>
          )}
          <GroupOwnerBadge groupId={groupId} />
        </div>
        <div className="flex items-center justify-self-end gap-3">
          {actorType === "member" ? <MemberAccountControls /> : <ExitGroupButton />}
          <TutorialButton />
          <ThemeToggle />
        </div>
      </div>
    </>
  );
}
