"use client";

import { useEffect, useState } from "react";
import { dedupedFetchJson } from "@/lib/dedupe-fetch";
import { cn } from "@/lib/cn";

interface GroupContext {
  hasOwner: boolean;
  ownerName: string | null;
}

// Self-fetching, matching MemberAccountControls/GroupSwitcher — GroupHeader
// is rendered by five view components, each fed from its own page, so
// plumbing ownerName as a prop would mean touching eleven files to show one
// line (session-persistence-and-ownership design §1). Renders nothing for
// an unowned group and nothing while loading; there's no useful interim
// state worth showing, and an "unclaimed" label would only nag.
export function GroupOwnerBadge({
  groupId,
  tone = "light",
}: {
  groupId: string;
  tone?: "light" | "forest";
}) {
  const [context, setContext] = useState<GroupContext | null>(null);

  useEffect(() => {
    let cancelled = false;
    dedupedFetchJson<GroupContext>(`/api/groups/${groupId}/context`).then((data) => {
      if (!cancelled) setContext(data);
    });
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  if (!context?.hasOwner || !context.ownerName) return null;

  return (
    <p
      className={cn(
        "truncate text-[11px]",
        tone === "forest" ? "text-cream/60" : "text-muted-2 dark:text-dark-muted",
      )}
    >
      Owned by {context.ownerName}
    </p>
  );
}
