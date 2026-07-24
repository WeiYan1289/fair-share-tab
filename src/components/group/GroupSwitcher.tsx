"use client";

import { useEffect, useRef, useState } from "react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { cn } from "@/lib/cn";
import { getDeviceIdentities } from "@/lib/device-identity";
import type { DeviceGroupIdentity } from "@/lib/device-identity";
import { CreateGroupModal } from "./CreateGroupModal";

interface GroupSwitcherProps {
  currentGroupId: string;
  currentGroupName: string;
}

// Screen Spec P3-01. Collapsed nav pill that opens a dropdown (desktop) /
// bottom sheet (mobile), same responsive-classes-on-one-markup approach as
// ShareDialog. The group list is this device's local storage (Screen Spec
// note: "scoped to groups the claimed member on this device belongs to"),
// not a server call.
export function GroupSwitcher({ currentGroupId, currentGroupName }: GroupSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<DeviceGroupIdentity[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setGroups(getDeviceIdentities());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function switchTo(identity: DeviceGroupIdentity) {
    if (identity.groupId === currentGroupId) {
      setOpen(false);
      return;
    }
    // Re-exchanges that group's cached token for a fresh session cookie —
    // the session only ever holds one active group at a time.
    window.location.href = `/g/${identity.token}`;
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-ink/10 bg-cream py-1.5 pr-3.5 pl-1.5 hover:bg-cream-hover dark:border-white/10 dark:bg-dark-card dark:hover:bg-dark-bg"
      >
        <InitialsAvatar name={currentGroupName} colorSeed={currentGroupId} shape="square" size={24} />
        <span className="text-[13.5px] font-bold text-ink dark:text-dark-text">{currentGroupName}</span>
        <span className="text-[11px] text-muted-2">▾</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 sm:hidden" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 z-50 rounded-t-xl bg-white p-3 pb-6 shadow-[0_-20px_40px_rgba(19,46,40,0.2)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:z-20 sm:mt-2 sm:w-80 sm:rounded-lg sm:p-2.5 sm:shadow-[0_24px_48px_-16px_rgba(19,46,40,0.28)] dark:bg-dark-card">
            <p className="mb-1.5 px-3 pt-1 text-[11px] font-bold tracking-wide text-muted-2 uppercase">
              Your groups
            </p>
            <div className="flex flex-col gap-0.5">
              {groups.map((g) => (
                <button
                  key={g.groupId}
                  type="button"
                  onClick={() => switchTo(g)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left",
                    g.groupId === currentGroupId
                      ? "bg-mint-tint dark:bg-mint/16"
                      : "hover:bg-cream dark:hover:bg-dark-bg",
                  )}
                >
                  <InitialsAvatar name={g.groupName} colorSeed={g.groupId} shape="square" size={32} />
                  <div className="flex-1">
                    <p className="text-[13.5px] font-bold text-ink dark:text-dark-text">{g.groupName}</p>
                    <p className="text-[11px] text-muted-2">
                      {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  {g.groupId === currentGroupId && (
                    <span className="text-emerald dark:text-mint">✓</span>
                  )}
                </button>
              ))}
            </div>
            <div className="my-1.5 h-px bg-ink/8 dark:bg-white/10" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setShowCreateGroup(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-md border border-dashed border-ink/18 px-3 py-2.5 text-left text-[13px] font-bold text-muted dark:border-white/18 dark:text-dark-muted"
            >
              + Create new group
            </button>
          </div>
        </>
      )}

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}
