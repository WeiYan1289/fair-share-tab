"use client";

import { useRef, useState } from "react";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useCountUp } from "@/lib/useCountUp";

export interface ChipMember {
  id: string;
  name: string;
  avatarColor: string;
  isActive: boolean;
  balance: number;
}

interface MemberChipProps {
  member: ChipMember;
  isYou: boolean;
  canEdit: boolean;
  onRenamed: (id: string, name: string) => void;
  onRequestDeactivate: (id: string, name: string) => void;
  onReactivated: (id: string) => void;
}

const PRESS_HOLD_MS = 600;

// Screen Spec P4-01 member chip + P4-04 inline rename / deactivated states.
// CLAUDE.md rule 5: the viewer's own name is always shown, with a quiet
// "you" marker -- never the bare word "You".
export function MemberChip({
  member,
  isYou,
  canEdit,
  onRenamed,
  onRequestDeactivate,
  onReactivated,
}: MemberChipProps) {
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(member.name);
  const [reactivating, setReactivating] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const balance = useCountUp(member.balance);

  function startPress() {
    if (!canEdit || renaming) return;
    pressTimer.current = setTimeout(() => {
      onRequestDeactivate(member.id, member.name);
    }, PRESS_HOLD_MS);
  }

  function cancelPress() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function commitRename() {
    const trimmed = draftName.trim();
    setRenaming(false);
    if (trimmed.length === 0 || trimmed === member.name) {
      setDraftName(member.name);
      return;
    }
    onRenamed(member.id, trimmed);
  }

  async function handleReactivate() {
    setReactivating(true);
    try {
      const res = await fetch(`/api/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (res.ok) onReactivated(member.id);
    } finally {
      setReactivating(false);
    }
  }

  if (!member.isActive) {
    return (
      <div className="flex min-w-[180px] items-center gap-2.5 rounded-md bg-cream px-4 py-3 opacity-70">
        <InitialsAvatar name={member.name} color={member.avatarColor} size={38} />
        <div className="flex-1">
          <p className="text-[13.5px] font-bold text-muted">{member.name}</p>
          <p className="text-[11px] text-muted-2">Inactive · stays on past bills</p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleReactivate}
            disabled={reactivating}
            className="text-[11px] font-bold whitespace-nowrap text-[#1F5C46] disabled:opacity-60"
          >
            Reactivate
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      className="flex min-w-[180px] items-center gap-2.5 rounded-md border border-ink/8 bg-white px-4 py-3 dark:border-white/8 dark:bg-dark-card"
    >
      <InitialsAvatar
        name={member.name}
        color={member.avatarColor}
        size={38}
        className={cn(isYou && "ring-2 ring-mint ring-offset-0")}
      />
      <div className="flex-1">
        {renaming ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraftName(member.name);
                setRenaming(false);
              }
            }}
            className="w-full border-b-[1.5px] border-forest bg-transparent text-[13.5px] font-bold text-ink outline-none dark:text-[#F2F6F3]"
          />
        ) : (
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => canEdit && setRenaming(true)}
            className="flex items-center gap-1.5 text-left text-[13.5px] font-bold text-ink dark:text-[#F2F6F3]"
          >
            {member.name}
            {isYou && (
              <span className="rounded-full bg-[#E4F9EE] px-[7px] py-px text-[9.5px] font-extrabold tracking-wide text-emerald dark:bg-mint/16 dark:text-mint">
                you
              </span>
            )}
            {canEdit && <span className="text-[11px] text-muted-2">✎</span>}
          </button>
        )}
        <p
          className={cn(
            "num text-[15px]",
            member.balance > 0 && "text-emerald",
            member.balance < 0 && "text-coral",
            member.balance === 0 && "text-muted",
          )}
        >
          {member.balance === 0
            ? "Settled up"
            : `${member.balance > 0 ? "+" : "-"}${formatMoney(Math.abs(balance))}`}
        </p>
      </div>
    </div>
  );
}
