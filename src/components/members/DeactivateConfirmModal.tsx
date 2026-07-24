"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface DeactivateConfirmModalProps {
  memberId: string;
  memberName: string;
  onClose: () => void;
  onDeactivated: () => void;
}

// Screen Spec P4-05. Members are never deleted (CLAUDE.md rule 4) --
// deactivation is reversible via the "Reactivate" chip affordance.
export function DeactivateConfirmModal({
  memberId,
  memberName,
  onClose,
  onDeactivated,
}: DeactivateConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDeactivate() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      if (!res.ok) throw new Error("deactivate failed");
      onDeactivated();
    } catch {
      setError("Couldn't deactivate — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-lg bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)]">
        <h2 className="num mb-2.5 text-[21px] text-ink">Deactivate {memberName}?</h2>
        <p className="mb-5.5 text-[13.5px] leading-relaxed text-muted">
          They&apos;ll stay attached to past bills but won&apos;t appear when adding new ones.
          Members are never deleted — you can reactivate them anytime.
        </p>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <button
            type="button"
            disabled={submitting}
            onClick={handleDeactivate}
            className="flex-1 rounded-md bg-gold py-3.5 text-center text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Deactivate
          </button>
        </div>
      </div>
    </div>
  );
}
