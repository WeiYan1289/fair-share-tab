"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CreateGroupModal } from "./CreateGroupModal";
import { ChevronDown, Plus } from "lucide-react";

interface GroupSummary {
  groupId: string;
  name: string;
}

interface GroupSwitcherProps {
  groupId: string;
  groupName: string;
}

// Replaces GroupHeader's plain group-name text for a logged-in member
// (CR-2.md #1/#2): a way back to their other groups without leaving the
// group they're in, plus a quick "+ Create new group" — instead of only
// reachable via the standalone /account/groups page. Not shown for a
// visitor, who has nothing to switch to (still exactly today's design).
export function GroupSwitcher({ groupId, groupName }: GroupSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[] | null>(null);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || groups !== null) return;
    let cancelled = false;
    fetch("/api/account/groups")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { groups: GroupSummary[] } | null) => {
        if (!cancelled) setGroups(data?.groups ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [open, groups]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative min-w-0 justify-self-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex max-w-full items-center gap-1 rounded-md px-2 py-1 text-[13.5px] font-bold text-ink hover:bg-ink/5 dark:text-dark-text dark:hover:bg-white/8"
      >
        <span className="min-w-0 truncate">{groupName}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-2" aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute top-full left-1/2 z-40 mt-1.5 w-[240px] -translate-x-1/2 rounded-md border border-ink/10 bg-white p-1.5 shadow-[0_16px_32px_-14px_rgba(19,46,40,0.35)] dark:border-white/10 dark:bg-dark-card">
          {groups === null ? (
            <p className="px-2.5 py-2 text-[12.5px] text-muted-2">Loading…</p>
          ) : groups.length === 0 ? (
            <p className="px-2.5 py-2 text-[12.5px] text-muted-2">No other groups yet.</p>
          ) : (
            <div className="mb-1 flex flex-col">
              {groups.map((group) => {
                const isCurrent = group.groupId === groupId;
                return isCurrent ? (
                  <span
                    key={group.groupId}
                    aria-current="true"
                    className="truncate rounded px-2.5 py-2 text-[13px] font-bold text-forest dark:text-mint"
                  >
                    {group.name}
                  </span>
                ) : (
                  <a
                    key={group.groupId}
                    href={`/api/account/groups/${group.groupId}/enter`}
                    className="truncate rounded px-2.5 py-2 text-[13px] text-ink hover:bg-cream dark:text-dark-text dark:hover:bg-white/8"
                  >
                    {group.name}
                  </a>
                );
              })}
            </div>
          )}

          <div className="my-1 h-px bg-ink/8 dark:bg-white/10" />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setShowCreateGroup(true);
            }}
            className="flex w-full items-center gap-1.5 rounded px-2.5 py-2 text-left text-[13px] font-bold text-ink hover:bg-cream dark:text-dark-text dark:hover:bg-white/8"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Create new group
          </button>
          <Link
            href="/account/groups"
            onClick={() => setOpen(false)}
            className="block rounded px-2.5 py-2 text-[13px] text-muted hover:bg-cream dark:text-dark-muted dark:hover:bg-white/8"
          >
            My groups
          </Link>
        </div>
      )}

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}
