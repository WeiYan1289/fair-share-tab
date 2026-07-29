"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { useCountUp } from "@/lib/useCountUp";
import { RenameMemberModal } from "./RenameMemberModal";
import { Button, Menu, MenuItem, MenuTrigger, Popover, type Key } from "react-aria-components";
import { MoreVertical, Pencil, Receipt, UserMinus, type LucideIcon } from "lucide-react";

interface ActionMenuItem {
  id: "expenses" | "rename" | "deactivate" | "reactivate";
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
}

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
  groupId: string;
  eventId: string;
  canEdit: boolean;
  onRenamed: (id: string, name: string) => void;
  onRequestDeactivate: (id: string, name: string) => void;
  onReactivated: (id: string) => void;
}

// Screen Spec P4-01 member chip + P4-04 deactivated state. No per-viewer
// identity is tracked (CLAUDE.md rule 5) -- every member renders
// identically for anyone with the link.
//
// Previously, tapping the name started a rename and a 600ms press-hold
// deactivated -- neither gesture had any visible affordance, so nothing on
// the chip suggested either existed. Both are replaced by one labelled
// overflow menu (View expenses / Rename / Deactivate), with the menu
// itself shortened to just "View expenses" for a viewer session, since
// Rename and Deactivate are already editor-only server-side.
//
// Renders two layouts sharing the same menu: a compact vertical card in a
// single horizontally-scrolling row on mobile (members never wrap to a
// second row there), and a wider horizontal chip that wraps normally on
// sm+.
export function MemberChip({
  member,
  currency,
  groupId,
  eventId,
  canEdit,
  onRenamed,
  onRequestDeactivate,
  onReactivated,
}: MemberChipProps) {
  const router = useRouter();
  const [renaming, setRenaming] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const balance = useCountUp(member.balance);

  const expensesHref = `/g/${groupId}/members/${member.id}/expenses?event=${eventId}`;

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

  function handleAction(key: Key) {
    if (key === "expenses") router.push(expensesHref);
    if (key === "rename") setRenaming(true);
    if (key === "deactivate") onRequestDeactivate(member.id, member.name);
  }

  const viewExpenses: ActionMenuItem = { id: "expenses", label: "View expenses", icon: Receipt };
  const menuItems: ActionMenuItem[] = !canEdit
    ? [viewExpenses]
    : member.isActive
      ? [
          viewExpenses,
          { id: "rename", label: "Rename", icon: Pencil },
          { id: "deactivate", label: "Deactivate", icon: UserMinus, danger: true },
        ]
      : [viewExpenses, { id: "reactivate", label: "Reactivate" }];

  function renderActionsMenu(compact: boolean) {
    return (
      <MenuTrigger>
        <Button
          aria-label={`Actions for ${member.name}`}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-md text-muted-2 outline-none hover:bg-ink/6 data-[pressed]:bg-ink/10 dark:hover:bg-white/8",
            compact ? "h-6 w-6 bg-white/70 dark:bg-dark-card/70" : "h-7 w-7",
          )}
        >
          <MoreVertical className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" />
        </Button>
        <Popover className="min-w-[172px] rounded-md border border-ink/10 bg-white p-1 shadow-[0_16px_32px_-14px_rgba(19,46,40,0.35)] dark:border-white/10 dark:bg-dark-card">
          <Menu
            onAction={(key) => {
              if (key === "reactivate") {
                handleReactivate();
              } else {
                handleAction(key);
              }
            }}
            className="outline-none"
          >
            {menuItems.map((item) => (
              <MenuItem
                key={item.id}
                id={item.id}
                isDisabled={item.id === "reactivate" && reactivating}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-[13px] font-medium outline-none data-[focused]:bg-cream dark:data-[focused]:bg-white/8",
                  item.danger ? "text-coral" : "text-ink dark:text-dark-text",
                )}
              >
                {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                {item.label}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </MenuTrigger>
    );
  }
  const actionsMenu = renderActionsMenu(false);
  const compactActionsMenu = renderActionsMenu(true);

  if (!member.isActive) {
    return (
      <>
        {/* Mobile: compact vertical card, part of the scrollable row. The
            menu sits as a small corner badge instead of its own row above
            the avatar, so the card is only as tall as its content needs. */}
        <div className="relative flex min-w-[82px] shrink-0 flex-col items-center gap-1 rounded-md bg-cream px-3 py-2.5 opacity-70 sm:hidden">
          <div className="absolute top-1 right-1">{compactActionsMenu}</div>
          <InitialsAvatar name={member.name} color={member.avatarColor} size={32} />
          <p className="text-[10.5px] font-semibold whitespace-nowrap text-muted">{member.name}</p>
          <p className="text-[9.5px] text-muted-2">Inactive</p>
        </div>

        {/* Desktop: wide horizontal chip, wraps */}
        <div className="hidden min-w-[180px] items-center gap-2.5 rounded-md bg-cream px-4 py-3 opacity-70 sm:flex">
          <InitialsAvatar name={member.name} color={member.avatarColor} size={38} />
          <div className="flex-1">
            <p className="text-[13.5px] font-bold text-muted">{member.name}</p>
            <p className="text-[11px] text-muted-2">Inactive · stays on past bills</p>
          </div>
          {actionsMenu}
        </div>

        {renaming && (
          <RenameMemberModal
            memberId={member.id}
            currentName={member.name}
            onClose={() => setRenaming(false)}
            onRenamed={(name) => {
              setRenaming(false);
              onRenamed(member.id, name);
            }}
          />
        )}
      </>
    );
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

  return (
    <>
      {/* Mobile: compact vertical card, part of the scrollable row. The
          menu sits as a small corner badge instead of its own row above
          the avatar, so the card is only as tall as its content needs. */}
      <div className="relative flex min-w-[82px] shrink-0 flex-col items-center gap-1 rounded-md border border-ink/8 bg-white px-3 py-2.5 sm:hidden dark:border-white/8 dark:bg-dark-card">
        <div className="absolute top-1 right-1">{compactActionsMenu}</div>
        <InitialsAvatar name={member.name} color={member.avatarColor} size={32} />
        <p className="max-w-[74px] truncate text-[10.5px] font-semibold text-ink dark:text-dark-text">
          {member.name}
        </p>
        <p className={cn("num text-[12px]", balanceColor)}>{balanceText}</p>
      </div>

      {/* Desktop: wide horizontal chip, wraps */}
      <div className="hidden min-w-[180px] items-center gap-2.5 rounded-md border border-ink/8 bg-white px-4 py-3 sm:flex dark:border-white/8 dark:bg-dark-card">
        <InitialsAvatar name={member.name} color={member.avatarColor} size={38} />
        <div className="flex-1">
          <p className="text-[13.5px] font-bold text-ink dark:text-dark-text">{member.name}</p>
          <p className={cn("num text-[15px]", balanceColor)}>{balanceText}</p>
        </div>
        {actionsMenu}
      </div>

      {renaming && (
        <RenameMemberModal
          memberId={member.id}
          currentName={member.name}
          onClose={() => setRenaming(false)}
          onRenamed={(name) => {
            setRenaming(false);
            onRenamed(member.id, name);
          }}
        />
      )}
    </>
  );
}
