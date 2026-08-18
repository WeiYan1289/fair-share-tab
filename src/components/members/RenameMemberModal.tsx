"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { describeApiError, NETWORK_ERROR_MESSAGE } from "@/components/ui/toast/error-message";
import { MAX_MEMBER_NAME_LENGTH } from "@/lib/constants";

interface RenameMemberModalProps {
  memberId: string;
  currentName: string;
  onClose: () => void;
  onRenamed: (name: string) => void;
}

// Reached from the member chip's "Rename" menu item (formerly an inline
// tap-to-edit on the name, which had no visible affordance that it was
// tappable). Mirrors AddMemberModal's shell.
export function RenameMemberModal({ memberId, currentName, onClose, onRenamed }: RenameMemberModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  async function handleSave() {
    if (!canSubmit) return;
    if (trimmed === currentName) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(describeApiError(res.status, body), "error");
        setError("Couldn't rename — check your connection and try again.");
        setSubmitting(false);
        return;
      }
      toast("Member renamed");
      onRenamed(trimmed);
    } catch {
      toast(NETWORK_ERROR_MESSAGE, "error");
      setError("Couldn't rename — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-4.5 text-xl text-ink sm:text-[22px] dark:text-dark-text">Rename member</h2>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Name</label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            maxLength={MAX_MEMBER_NAME_LENGTH}
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
          />
        </div>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={handleSave} className="flex-1 text-center">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
