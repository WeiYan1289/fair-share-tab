"use client";

import { useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CreateGroupModal } from "@/components/group/CreateGroupModal";
import { colorForSeed } from "@/lib/constants";

interface GroupSummary {
  groupId: string;
  name: string;
  memberCount: number;
  eventCount: number;
}

interface MyGroupsViewProps {
  email: string;
  groups: GroupSummary[];
}

// The landing surface for a registered member — unlimited groups are the
// core differentiator from an anonymous visitor (capped at one), so this
// page is where they all live once an account exists.
export function MyGroupsView({ email, groups }: MyGroupsViewProps) {
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-cream px-5 py-6 sm:px-9 sm:py-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[1160px]">
        <div className="mb-8 flex items-center justify-between sm:mb-10">
          <Logo size={26} wordmarkClassName="text-base sm:text-lg" />
          <div className="flex items-center gap-4">
            <span className="hidden text-[12.5px] text-muted sm:inline dark:text-dark-muted">{email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="text-[12.5px] font-bold text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text"
            >
              Log out
            </button>
            <ThemeToggle />
          </div>
        </div>

        {groups.length === 0 ? (
          <EmptyState onCreate={() => setShowCreateGroup(true)} />
        ) : (
          <>
            <div className="mb-6 flex items-end justify-between sm:mb-[30px]">
              <div>
                <h1 className="num text-[28px] text-ink sm:text-[34px] dark:text-dark-text">My groups</h1>
                <p className="mt-1.5 text-[13px] text-muted sm:text-[13.5px] dark:text-dark-muted">
                  {groups.length} group{groups.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="hidden rounded-md bg-forest px-6 py-3.5 text-sm font-bold text-cream shadow-[0_8px_20px_-6px_rgba(22,58,46,0.5)] hover:bg-forest-hover sm:block dark:bg-dark-forest"
              >
                + Create group
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {groups.map((group) => (
                <GroupCard key={group.groupId} group={group} />
              ))}
            </div>
          </>
        )}
      </div>

      {groups.length > 0 && (
        <button
          type="button"
          onClick={() => setShowCreateGroup(true)}
          aria-label="Create group"
          className="fixed right-5 bottom-8 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-3xl text-cream shadow-[0_10px_24px_-6px_rgba(22,58,46,0.55)] sm:hidden dark:bg-dark-forest"
        >
          +
        </button>
      )}

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mb-6 flex h-[88px] w-[88px] items-center justify-center rounded-full bg-mint-tint dark:bg-mint/16">
        <div className="relative h-8 w-8 rounded-[9px] border-[3px] border-forest dark:border-mint">
          <span className="absolute top-1/2 left-1/2 h-[3px] w-[15px] -translate-x-1/2 -translate-y-1/2 bg-forest dark:bg-mint" />
          <span className="absolute top-1/2 left-1/2 h-[15px] w-[3px] -translate-x-1/2 -translate-y-1/2 bg-forest dark:bg-mint" />
        </div>
      </div>
      <h1 className="num mb-2.5 text-2xl text-ink sm:text-[26px] dark:text-dark-text">No groups yet</h1>
      <p className="mb-6 max-w-[380px] text-[14px] leading-relaxed text-muted sm:text-[14.5px] dark:text-dark-muted">
        As a member, you can create as many groups as you like — a family group, a
        colleague group, a trip gang, all in one place.
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="rounded-md bg-forest px-6 py-3.5 text-sm font-bold text-cream shadow-[0_8px_20px_-6px_rgba(22,58,46,0.5)] hover:bg-forest-hover dark:bg-dark-forest"
      >
        + Create your first group
      </button>
    </div>
  );
}

function GroupCard({ group }: { group: GroupSummary }) {
  const color = colorForSeed(group.groupId);
  const letter = group.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <a
      href={`/api/account/groups/${group.groupId}/enter`}
      className="block rounded-lg border border-ink/7 bg-white p-5 shadow-[0_16px_32px_-18px_rgba(19,46,40,0.18)] transition-shadow hover:shadow-[0_20px_40px_-16px_rgba(19,46,40,0.24)] sm:p-6 dark:border-white/7 dark:bg-dark-card"
    >
      <div className="mb-4 flex items-center gap-3">
        <div
          className="flex h-[42px] w-[42px] items-center justify-center rounded-md text-[15px] font-extrabold"
          style={{ backgroundColor: `${color}1A`, color }}
        >
          {letter}
        </div>
        <div className="text-[17px] font-bold text-ink dark:text-dark-text">{group.name}</div>
      </div>
      <p className="text-[13px] text-muted dark:text-dark-muted">
        {group.memberCount} member{group.memberCount === 1 ? "" : "s"} · {group.eventCount} event
        {group.eventCount === 1 ? "" : "s"}
      </p>
    </a>
  );
}
