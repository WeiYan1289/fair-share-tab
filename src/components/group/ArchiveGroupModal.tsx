"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/toast/ToastProvider";
import { describeApiError, NETWORK_ERROR_MESSAGE } from "@/components/ui/toast/error-message";

interface ArchiveGroupModalProps {
  group: { groupId: string; name: string };
  onClose: () => void;
  onArchived: () => void;
}

// Owner-only (server-enforced). Copy leads with the consequence that
// matters: every share link goes dormant until restore.
export function ArchiveGroupModal({ group, onClose, onArchived }: ArchiveGroupModalProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/groups/${group.groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast(describeApiError(res.status, body), "error");
        setError("Couldn't archive — check your connection and try again.");
        setSubmitting(false);
        return;
      }
      toast("Group archived");
      onArchived();
    } catch {
      toast(NETWORK_ERROR_MESSAGE, "error");
      setError("Couldn't archive — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-2.5 text-xl text-ink sm:text-[22px] dark:text-dark-text">
          Archive {group.name}?
        </h2>
        <p className="mb-5 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
          Everyone&apos;s share links stop working while the group is archived —
          visitors see an &ldquo;archived by its owner&rdquo; notice instead.
          Restore the group any time and the same links work again. Nothing is
          deleted.
        </p>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={submitting} onClick={handleArchive} className="flex-1 text-center">
            Archive group
          </Button>
        </div>
      </div>
    </div>
  );
}
