"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

interface MemberTabsProps {
  groupId: string;
  memberId: string;
}

// Screen Spec P4-06 (expenses) / P4-07 (balance). Two real, bookmarkable
// routes rather than a client-side mode flag -- balance and spend history
// are different questions with different answers, kept on separate
// screens so neither is crowded.
export function MemberTabs({ groupId, memberId }: MemberTabsProps) {
  const pathname = usePathname();
  const active = pathname?.endsWith("/balance") ? "balance" : "expenses";

  const tabs = [
    { key: "expenses" as const, label: "Expenses", href: `/g/${groupId}/members/${memberId}/expenses` },
    { key: "balance" as const, label: "Balance", href: `/g/${groupId}/members/${memberId}/balance` },
  ];

  return (
    <div className="mb-4 flex gap-6 border-b border-ink/8 sm:mb-6 dark:border-white/8" role="tablist">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          role="tab"
          aria-selected={active === tab.key}
          className={cn(
            "-mb-px border-b-2 pb-2.5 text-sm font-bold",
            active === tab.key
              ? "border-forest text-ink dark:border-mint dark:text-dark-text"
              : "border-transparent text-muted-2 hover:text-ink dark:hover:text-dark-text",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
