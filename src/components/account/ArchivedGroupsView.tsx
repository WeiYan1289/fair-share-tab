"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { RestoreButton } from "@/components/ui/RestoreButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TutorialButton } from "@/components/ui/TutorialButton";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { describeApiError, NETWORK_ERROR_MESSAGE } from "@/components/ui/toast/error-message";
import { LogOut } from "lucide-react";

interface ArchivedGroupSummary {
  groupId: string;
  name: string;
  isOwner: boolean;
  memberCount: number;
  eventCount: number;
  // Pre-formatted server-side (e.g. "6 Aug"), not a raw timestamp -- see
  // the page.tsx comment for why formatting must happen exactly once, on
  // the server, to avoid a UTC-vs-UTC+8 hydration mismatch.
  archivedAtLabel: string | null;
}

interface ArchivedGroupsViewProps {
  email: string;
  groups: ArchivedGroupSummary[];
}

// Read-only ledger for archived groups (archived-readonly plan, T4) --
// mirrors ArchivedEventsView.tsx so the two archive screens read as one
// idiom. A ruled list, not the card grid: the only interactive control per
// row is its Restore button, and only the owner gets one.
export function ArchivedGroupsView({ email, groups }: ArchivedGroupsViewProps) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <div className="min-h-screen bg-cream px-5 py-6 sm:px-9 sm:py-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[720px]">
        {/* Same chrome as the parent /account/groups page (Logo, email,
            log out, tutorial, theme toggle) -- this screen is one click
            deeper, not a stripped-down offshoot, so navigating here
            shouldn't lose any of those controls. */}
        <div className="mb-6 flex items-center justify-between sm:mb-8">
          <Logo size={26} wordmarkClassName="text-base sm:text-lg" />
          <div className="flex items-center gap-2 sm:gap-4">
            <span className="hidden max-w-[160px] truncate text-[12.5px] text-muted sm:inline dark:text-dark-muted">
              {email}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
              className="flex h-7 w-7 items-center justify-center text-muted hover:text-ink sm:hidden dark:text-dark-muted dark:hover:text-dark-text"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden text-[12.5px] font-bold text-muted hover:text-ink sm:inline dark:text-dark-muted dark:hover:text-dark-text"
            >
              Log out
            </button>
            <TutorialButton />
            <ThemeToggle />
          </div>
        </div>

        <Link
          href="/account/groups"
          className="mb-4 block text-[13px] font-bold text-link dark:text-mint"
        >
          ← Back to my groups
        </Link>

        <div className="mb-6 sm:mb-8">
          <h1 className="num text-[22px] text-ink sm:text-[34px] dark:text-dark-text">
            Archived groups
          </h1>
          <p className="mt-1.5 max-w-[480px] text-[13px] leading-relaxed text-muted sm:text-[13.5px] dark:text-dark-muted">
            {groups.length} group{groups.length === 1 ? "" : "s"}. Archived groups can&rsquo;t
            be opened by anyone, including you. Restoring a group makes its share links work
            again.
          </p>
        </div>

        {groups.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-ink/8 border-t border-b border-ink/8 dark:divide-white/8 dark:border-white/8">
            {groups.map((group) => (
              <ArchivedGroupRow key={group.groupId} group={group} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
      <p className="mb-2.5 text-[15px] font-bold text-ink dark:text-dark-text">
        Nothing archived yet
      </p>
      <p className="mb-6 max-w-[340px] text-[13px] leading-relaxed text-muted dark:text-dark-muted">
        Groups you archive from My groups will show up here.
      </p>
      <Link href="/account/groups" className="text-[13px] font-bold text-link dark:text-mint">
        ← Back to my groups
      </Link>
    </div>
  );
}

function ArchivedGroupRow({ group }: { group: ArchivedGroupSummary }) {
  const router = useRouter();
  const { toast } = useToast();
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const metaParts = [
    `${group.memberCount} member${group.memberCount === 1 ? "" : "s"}`,
    `${group.eventCount} event${group.eventCount === 1 ? "" : "s"}`,
  ];
  if (group.archivedAtLabel) {
    metaParts.push(`archived ${group.archivedAtLabel}`);
  }

  async function handleRestore() {
    if (restoring) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const res = await fetch(`/api/account/groups/${group.groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(describeApiError(res.status, body), "error");
        setRestoreError("Couldn't restore — check your connection and try again.");
        setRestoring(false);
        return;
      }
      toast("Group restored");
      router.refresh();
    } catch {
      toast(NETWORK_ERROR_MESSAGE, "error");
      setRestoreError("Couldn't restore — check your connection and try again.");
      setRestoring(false);
    }
  }

  return (
    // A plain div, not a Link/form -- the row itself is inert (design
    // intent: a ruled record, not something to poke at). The only
    // interactive control is the Restore button below, and only for owners.
    <div className="flex items-center justify-between gap-3 py-4 sm:gap-4 sm:py-5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold text-ink sm:text-[16px] dark:text-dark-text">
          {group.name}
        </p>
        {/* Wraps rather than truncates: a group row has no money column
            competing for the width, so the meta almost always fits on one
            line, and on the rare long one a second line beats a clipped
            date. */}
        <p className="mt-0.5 text-[11.5px] text-muted sm:text-[12.5px] dark:text-dark-muted">
          {metaParts.join(" · ")}
        </p>
      </div>

      {/* Pinned right at every width -- see ArchivedEventsView for the same
          row shape. A group row has no money column, so this is the only
          thing on the right. */}
      {group.isOwner && (
        <div className="relative shrink-0">
          <RestoreButton
            label={`Restore ${group.name}`}
            restoring={restoring}
            onClick={handleRestore}
          />
          {restoreError && (
            <p className="absolute top-full right-0 mt-1 w-[180px] text-right text-[11px] leading-snug text-coral">
              {restoreError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
