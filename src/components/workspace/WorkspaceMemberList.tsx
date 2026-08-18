"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddMemberModal } from "@/components/members/AddMemberModal";
import type { GroupCurrencyOverview } from "@/lib/expenses";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { ChevronDown, ChevronRight } from "lucide-react";

// Tier 2 of the desktop group workspace: the group's overall money position per
// currency. Unlike the classic Overall panel it shows EVERY currency with
// outstanding money (single-event currencies included -- getGroupCurrencyOverviews),
// leads with the fewest transfers that clear everyone, and folds the per-member
// balances behind a toggle. The currency dropdown scopes only this section
// (rule 1: currencies are never netted together); it never filters the event
// blocks below.
export function WorkspaceMemberList({
  groupId,
  canEdit,
  overviews,
  spentByCurrency,
  collapsed,
  onToggleCollapse,
  onSettle,
}: {
  groupId: string;
  canEdit: boolean;
  overviews: GroupCurrencyOverview[];
  spentByCurrency: Record<string, { memberId: string; name: string; spent: number }[]>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSettle: (currency: string) => void;
}) {
  const router = useRouter();
  const [selectedCurrency, setSelectedCurrency] = useState(overviews[0]?.currency ?? null);
  const [showMembers, setShowMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const active = overviews.find((o) => o.currency === selectedCurrency) ?? overviews[0] ?? null;

  // Every member who spent in this currency, with their total spend and net
  // (0 for those who came out square), creditors first.
  const netByMember = new Map((active?.members ?? []).map((m) => [m.memberId, m.net]));
  const memberRows = active
    ? (spentByCurrency[active.currency] ?? [])
        .map((r) => ({ ...r, net: netByMember.get(r.memberId) ?? 0 }))
        .sort((a, b) => b.net - a.net)
    : [];

  return (
    <section className="rounded-lg border border-ink/7 bg-white px-4 py-3.5 sm:px-5 sm:py-4 dark:border-white/7 dark:bg-dark-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-expanded={!collapsed}
          className="flex min-w-0 items-center gap-2.5 text-left"
        >
          <span className="shrink-0 text-muted-2" aria-hidden="true">
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
          <p className="text-[11px] font-bold tracking-wide text-muted-2 uppercase">
            Members
            {active ? <> · overall balances{overviews.length === 1 ? ` · ${active.currency}` : ""}</> : null}
          </p>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAddMember(true)}
              className="rounded-md border border-dashed border-ink/20 px-3 py-1.5 text-[12px] font-bold text-muted hover:text-ink dark:border-white/20 dark:text-dark-muted dark:hover:text-dark-text"
            >
              + Add member
            </button>
          )}
          {overviews.length > 1 && (
            <div className="relative">
              <select
                value={selectedCurrency ?? ""}
                onChange={(e) => {
                  setSelectedCurrency(e.target.value);
                  setShowMembers(false);
                }}
                aria-label="Currency"
                className="appearance-none rounded-md border border-ink/14 bg-white py-1.5 pr-7 pl-2.5 text-[12px] font-bold text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-card dark:text-dark-text"
              >
                {overviews.map((o) => (
                  <option key={o.currency} value={o.currency}>
                    {o.currency}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-2"
                aria-hidden="true"
              />
            </div>
          )}
          {canEdit && active && (
            <button
              type="button"
              onClick={() => onSettle(active.currency)}
              className="rounded-md bg-forest px-3.5 py-1.5 text-[12px] font-bold text-cream hover:bg-forest-hover dark:bg-dark-forest"
            >
              {active.eventCount === 1 ? "Settle up" : "Settle all"}
            </button>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="mt-3.5 border-t border-ink/8 pt-3.5 dark:border-white/8">
          {!active ? (
            <p className="text-[12.5px] text-muted dark:text-dark-muted">
              Nothing outstanding across events right now.
            </p>
          ) : (
            <>
              <p className="mb-2 text-[11px] text-muted-2">
                {active.transfers.length} transfer{active.transfers.length === 1 ? "" : "s"} to
                settle · {active.eventCount} event{active.eventCount === 1 ? "" : "s"}
              </p>
              {active.transfers.length === 0 ? (
                <p className="text-[12.5px] text-muted dark:text-dark-muted">
                  Everyone&rsquo;s square in {active.currency}.
                </p>
              ) : (
                <div className="divide-y divide-ink/8 border-t border-ink/8 dark:divide-white/8 dark:border-white/8">
                  {active.transfers.map((t) => (
                    <div
                      key={`${t.fromMemberId}-${t.toMemberId}`}
                      className="flex items-center justify-between gap-3 py-2"
                    >
                      <p className="min-w-0 truncate text-[13px] text-ink dark:text-dark-text">
                        <span className="font-bold">{t.fromName}</span>
                        <span className="mx-1.5 text-muted-2">→</span>
                        {t.toName}
                      </p>
                      <p className="num shrink-0 text-[13.5px] text-ink dark:text-dark-text">
                        {formatMoney(t.amount, active.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowMembers((v) => !v)}
                aria-expanded={showMembers}
                className="mt-3 flex items-center gap-1 text-[11px] font-bold text-muted-2 hover:text-ink dark:hover:text-dark-text"
              >
                <span className="text-[10px]">{showMembers ? "▾" : "▸"}</span>
                {showMembers ? "Hide member details" : "Show member details"}
              </button>
              {showMembers && (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {memberRows.map((r) => (
                    <div
                      key={r.memberId}
                      className="rounded-md border border-ink/8 px-3 py-2 dark:border-white/8"
                    >
                      <p className="truncate text-[13px] text-ink dark:text-dark-text">{r.name}</p>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-[11.5px]">
                        <span className="text-muted-2">
                          Spent {formatMoney(r.spent, active.currency)}
                        </span>
                        <span
                          className={cn(
                            "num",
                            r.net > 0 && "text-emerald dark:text-mint",
                            r.net < 0 && "text-coral",
                            r.net === 0 && "text-muted-2",
                          )}
                        >
                          {r.net > 0 ? "+" : r.net < 0 ? "-" : ""}
                          {formatMoney(Math.abs(r.net), active.currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showAddMember && (
        <AddMemberModal
          scope={{ type: "group", groupId }}
          onClose={() => setShowAddMember(false)}
          onAdded={() => {
            setShowAddMember(false);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
