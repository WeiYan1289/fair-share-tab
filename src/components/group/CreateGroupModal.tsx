"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

interface CreateGroupModalProps {
  onClose: () => void;
}

// Screen Spec P2-01. Opened from the landing page's "Create a group" CTA
// (also from GroupSwitcher for a logged-in member creating an additional
// group). Full page reload on success, not a router push: the server just
// set a fresh session cookie for the new group and the events page needs it.
export function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [yourName, setYourName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [namePrefilled, setNamePrefilled] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when POST /api/groups rejects an anonymous caller's second group
  // (system-design.md §3.3) — distinct from a generic error so the message
  // can point at registration instead of "try again."
  const [capBlocked, setCapBlocked] = useState(false);

  // Prefills "Your name" for a logged-in member from their most recent
  // group, so creating a second/third group doesn't ask a question the
  // account already effectively knows the answer to (CR-2.md #3). Stays
  // editable rather than auto-submitted — Member.name is deliberately
  // per-group (CLAUDE.md rule 6), so silently reusing it without letting
  // someone see/change it would trade one confusion for another. A visitor
  // gets a 401 from /api/auth/me and the field just stays blank, as today.
  useEffect(() => {
    let cancelled = false;
    async function loadSuggestedName() {
      const res = await fetch("/api/auth/me");
      if (!res.ok || cancelled) return;
      const data: { user: { suggestedName: string | null } } = await res.json();
      if (data.user.suggestedName) {
        setYourName(data.user.suggestedName);
        setNamePrefilled(true);
      }
    }
    loadSuggestedName();
    return () => {
      cancelled = true;
    };
  }, []);

  const nameMissing = nameTouched && yourName.trim().length === 0;
  const canSubmit = groupName.trim().length > 0 && yourName.trim().length > 0 && !submitting;

  async function handleCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setCapBlocked(false);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          creatorName: yourName.trim(),
        }),
      });
      if (!res.ok) {
        if (res.status === 403) {
          setCapBlocked(true);
          setSubmitting(false);
          return;
        }
        throw new Error("create failed");
      }
      const data = await res.json();

      window.location.href = `/g/${data.group.id}/events?savelink=${data.shareLink.token}`;
    } catch {
      setError("Couldn't create the group — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-lg bg-white p-7 shadow-[0_24px_48px_-16px_rgba(19,46,40,0.28)] dark:bg-dark-card">
        <h2 className="num mb-4 text-xl text-ink dark:text-dark-text">Create a new group</h2>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Group name</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ski Trip Crew"
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
          />
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Your name</label>
          <input
            type="text"
            value={yourName}
            onChange={(e) => {
              setYourName(e.target.value);
              setNamePrefilled(false);
            }}
            onBlur={() => setNameTouched(true)}
            placeholder="Your name"
            className={cn(
              "w-full rounded-md border-[1.5px] bg-cream px-3.5 py-3 text-sm text-ink outline-none dark:bg-dark-bg dark:text-dark-text",
              nameMissing
                ? "border-coral bg-coral-tint dark:bg-coral/10"
                : "border-ink/14 focus:border-forest dark:border-white/14",
            )}
          />
          <p
            className={cn(
              "mt-1.5 text-[11px] leading-relaxed",
              nameMissing ? "text-coral" : "text-muted-2",
            )}
          >
            {nameMissing
              ? "Required — this is how the group will see you in bills and balances."
              : namePrefilled
                ? "Filled in from your account — change it if this group should show something different."
                : "This is how the group will see you in bills and balances."}
          </p>
        </div>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}
        {capBlocked && (
          <p className="mb-3 rounded-md bg-coral-tint px-3 py-2.5 text-xs leading-relaxed text-coral dark:bg-coral/10">
            You&apos;ve already created one group as a guest. Create a free account to make more —{" "}
            <Link href="/register" className="font-bold underline">
              register
            </Link>
            .
          </p>
        )}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={handleCreate}
            className="flex-1 text-center"
          >
            Create group
          </Button>
        </div>
      </div>
    </div>
  );
}
