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
  currency: string;
  isYou: boolean;
  canEdit: boolean;
  onRenamed: (id: string, name: string) => void;
  onRequestDeactivate: (id: string, name: string) => void;
  onReactivated: (id: string) => void;
}

const PRESS_HOLD_MS = 600;

// Screen Spec P4-01 member chip + P4-04 inline rename / deactivated states.
// CLAUDE.md rule 5: the viewer's own name is always shown, with a quiet
// "you" marker -- never the bare word "You". Renders two layouts sharing
// the same rename/press-hold state: a compact vertical card in a single
// horizontally-scrolling row on mobile (P4-01's mobile mock -- members
// never wrap to a second row there), and the wider horizontal chip that
// wraps normally on sm+ (the desktop mock).
export function MemberChip({
  member,
  currency,
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

  const balanceText =
    member.balance === 0
      ? "Settled up"
      : `${member.balance > 0 ? "+" : "-"}${formatMoney(Math.abs(balance), currency)}`;
  const balanceColor = cn(
    member.balance > 0 && "text-emerald dark:text-mint",
    member.balance < 0 && "text-coral",
    member.balance === 0 && "text-muted dark:text-dark-muted",
  );

  if (!member.isActive) {
    return (
      <>
        {/* Mobile: compact vertical card, part of the scrollable row */}
        <button
          type="button"
          onClick={canEdit ? handleReactivate : undefined}
          disabled={reactivating}
          className="flex min-w-[78px] shrink-0 flex-col items-center gap-1.5 rounded-md bg-cream px-3 py-2.5 opacity-70 sm:hidden"
        >
          <InitialsAvatar name={member.name} color={member.avatarColor} size={34} />
          <p className="text-[10.5px] font-semibold whitespace-nowrap text-muted">
            {member.name}
          </p>
          <p className="text-[9.5px] text-muted-2">{canEdit ? "Reactivate" : "Inactive"}</p>
        </button>

        {/* Desktop: wide horizontal chip, wraps */}
        <div className="hidden min-w-[180px] items-center gap-2.5 rounded-md bg-cream px-4 py-3 opacity-70 sm:flex">
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
              className="text-[11px] font-bold whitespace-nowrap text-link disabled:opacity-60"
            >
              Reactivate
            </button>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      {/* Mobile: compact vertical card, part of the scrollable row */}
      <div
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        className="flex min-w-[78px] shrink-0 flex-col items-center gap-1.5 rounded-md border border-ink/8 bg-white px-3 py-2.5 sm:hidden dark:border-white/8 dark:bg-dark-card"
      >
        <InitialsAvatar
          name={member.name}
          color={member.avatarColor}
          size={34}
          className={cn(isYou && "ring-2 ring-mint ring-offset-0")}
        />
        <p className="max-w-[70px] truncate text-[10.5px] font-semibold text-ink dark:text-dark-text">
          {member.name}
        </p>
        <p className={cn("num text-[12px]", balanceColor)}>{balanceText}</p>
      </div>

      {/* Desktop: wide horizontal chip, wraps */}
      <div
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        className="hidden min-w-[180px] items-center gap-2.5 rounded-md border border-ink/8 bg-white px-4 py-3 sm:flex dark:border-white/8 dark:bg-dark-card"
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
              className="w-full border-b-[1.5px] border-forest bg-transparent text-[13.5px] font-bold text-ink outline-none dark:text-dark-text"
            />
          ) : (
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => canEdit && setRenaming(true)}
              className="flex items-center gap-1.5 text-left text-[13.5px] font-bold text-ink dark:text-dark-text"
            >
              {member.name}
              {isYou && (
                <span className="rounded-full bg-mint-tint px-[7px] py-px text-[9.5px] font-extrabold tracking-wide text-emerald dark:bg-mint/16 dark:text-mint">
                  you
                </span>
              )}
              {canEdit && <span className="text-[11px] text-muted-2">✎</span>}
            </button>
          )}
          <p className={cn("num text-[15px]", balanceColor)}>{balanceText}</p>
        </div>
      </div>
    </>
  );
}
