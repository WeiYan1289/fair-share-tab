"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface RenameGroupModalProps {
  groupId: string;
  currentName: string;
  onClose: () => void;
  onRenamed: (name: string) => void;
}

// Reached from the group card's overflow menu on /account/groups. Mirrors
// RenameEventModal's shell so the rename flows read as one idiom. The
// server gate is owner-only (getGroupOwner) — a 403 here surfaces as the
// generic error line.
export function RenameGroupModal({ groupId, currentName, onClose, onRenamed }: RenameGroupModalProps) {
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
      const res = await fetch(`/api/account/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        setError(
          res.status === 403
            ? "Only the group owner can rename this group."
            : "Couldn't rename — check your connection and try again.",
        );
        setSubmitting(false);
        return;
      }
      onRenamed(trimmed);
    } catch {
      setError("Couldn't rename — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-4.5 text-xl text-ink sm:text-[22px] dark:text-dark-text">Rename group</h2>

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
