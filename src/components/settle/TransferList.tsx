import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatMoney } from "@/lib/format";
import type { SettleMember, Transfer } from "./SettleUpFlow";

interface TransferListProps {
  transfers: Transfer[];
  members: SettleMember[];
  currency: string;
}

// The alternative to TransferGraph's node-and-arrow view (Screen Spec
// P6-02) -- ordered rows instead of a spatial layout, so there is nothing
// to lay out or collide: it reads the same at 6 transfers or 60, on
// mobile or desktop, light or dark, and holds up as a screenshot shared
// into a group chat (CLAUDE.md rule 5). SettleUpFlow defaults to this view
// once the graph would otherwise get crowded.
export function TransferList({ transfers, members, currency }: TransferListProps) {
  const memberById = new Map(members.map((m) => [m.id, m]));

  return (
    <div className="mx-auto w-full max-w-[520px] divide-y divide-ink/8 rounded-lg border border-ink/8 bg-white px-4 dark:divide-white/8 dark:border-white/8 dark:bg-dark-card">
      {transfers.map((t, i) => {
        const from = memberById.get(t.fromMemberId);
        const to = memberById.get(t.toMemberId);
        return (
          <div key={i} className="flex items-center justify-between gap-2 py-3">
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {/* Each name gets up to two lines (member names are capped at
                  MAX_MEMBER_NAME_LENGTH, so two short lines almost always
                  fit) -- only a name that would still need a third line
                  falls back to an ellipsis, via line-clamp rather than a
                  single-line truncate. */}
              <InitialsAvatar name={from?.name ?? ""} color={from?.avatarColor} size={24} className="shrink-0 text-[10px]" />
              <span className="line-clamp-2 min-w-0 max-w-[64px] text-[11px] leading-tight font-bold text-ink dark:text-dark-text">
                {from?.name}
              </span>
              <span className="shrink-0 text-[13px] text-muted-2" aria-hidden="true">
                →
              </span>
              <InitialsAvatar name={to?.name ?? ""} color={to?.avatarColor} size={24} className="shrink-0 text-[10px]" />
              <span className="line-clamp-2 min-w-0 max-w-[64px] text-[11px] leading-tight font-bold text-ink dark:text-dark-text">
                {to?.name}
              </span>
            </div>
            <span className="num shrink-0 text-[14px] text-ink dark:text-dark-text">
              {formatMoney(t.amount, currency)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
