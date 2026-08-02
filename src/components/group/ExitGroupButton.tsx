"use client";

import { useState } from "react";
import { DoorOpen } from "lucide-react";
import { Button } from "@/components/ui/Button";

// The visitor counterpart to MemberAccountControls' "Log out" — occupies
// the identical header slot, which is otherwise empty for a visitor
// session (session-persistence-and-ownership design §4). Same
// icon-on-mobile / text-on-sm+ responsive pattern as MemberAccountControls,
// so the header layout doesn't shift based on actor type.
export function ExitGroupButton() {
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label="Exit group"
        title="Exit group"
        className="flex h-7 w-7 items-center justify-center text-muted hover:text-ink sm:hidden dark:text-dark-muted dark:hover:text-dark-text"
      >
        <DoorOpen className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="hidden text-[12px] font-bold text-muted hover:text-ink sm:inline dark:text-dark-muted dark:hover:text-dark-text"
      >
        Exit group
      </button>
      {confirming && <ExitGroupConfirmModal onClose={() => setConfirming(false)} />}
    </>
  );
}

// Deliberately blunt: exiting is irreversible from the app's side (the
// token is stripped from the address bar on arrival — CLAUDE.md rule 8 —
// so ShareDialog inside the group was the only place to recover it). It's
// also irreversible in a second way for a guest creator: POST
// /api/session/exit clears the visitor-cap cookie along with the group
// session, so a guest who exits permanently loses their one-time
// eligibility to register and claim this group later, not just their
// current visit to it. The copy below has to say both things.
// Shape mirrors DeactivateConfirmModal.
function ExitGroupConfirmModal({ onClose }: { onClose: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/session/exit", { method: "POST" });
      if (!res.ok) throw new Error("exit failed");
      window.location.href = "/";
    } catch {
      setError("Couldn't exit — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-lg bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] dark:bg-dark-card">
        <h2 className="num mb-2.5 text-[21px] text-ink dark:text-dark-text">Exit this group?</h2>
        <p className="mb-5.5 text-[13.5px] leading-relaxed text-muted dark:text-dark-muted">
          You&apos;ll need the share link again to come back — FairShareTab can&apos;t recover
          it for you. Save it somewhere first if you&apos;re not sure. If you created this group
          as a guest, exiting also means you can&apos;t register later to become its owner.
        </p>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleExit}
            className="flex-1 rounded-md bg-gold py-3.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Exit group
          </button>
        </div>
      </div>
    </div>
  );
}
