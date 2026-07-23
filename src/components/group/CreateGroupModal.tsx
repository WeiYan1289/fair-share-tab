"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { saveDeviceIdentity } from "@/lib/device-identity";
import { SUPPORTED_CURRENCY } from "@/lib/validation/group";

interface CreateGroupModalProps {
  onClose: () => void;
}

// Screen Spec P2-01 / P3-01 (the create-group modal is designed alongside
// the switcher that opens it, but the landing page's "Create a group" CTA
// opens the same modal — both exit to the new group's events list the same
// way). Full page reload on success, not a router push: the server just set
// a fresh session cookie for the new group and the events page needs it.
export function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [yourName, setYourName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameMissing = nameTouched && yourName.trim().length === 0;
  const canSubmit = groupName.trim().length > 0 && yourName.trim().length > 0 && !submitting;

  async function handleCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          currency: SUPPORTED_CURRENCY,
          creatorName: yourName.trim(),
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const data = await res.json();

      saveDeviceIdentity({
        groupId: data.group.id,
        groupName: data.group.name,
        memberId: data.creatorMemberId,
        memberName: yourName.trim(),
        memberAvatarColor: data.creatorAvatarColor,
        token: data.shareLink.token,
        memberCount: 1,
      });
      window.location.href = `/g/${data.group.id}/events`;
    } catch {
      setError("Couldn't create the group — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-lg bg-white p-7 shadow-[0_24px_48px_-16px_rgba(19,46,40,0.28)]">
        <h2 className="num mb-4 text-xl text-ink">Create a new group</h2>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Group name</label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Ski Trip Crew"
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest"
          />
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Your name</label>
          <input
            type="text"
            value={yourName}
            onChange={(e) => setYourName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder="Your name"
            className={cn(
              "w-full rounded-md border-[1.5px] bg-cream px-3.5 py-3 text-sm text-ink outline-none",
              nameMissing ? "border-coral bg-[#FBEAE6]" : "border-ink/14 focus:border-forest",
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
              : "This is how the group will see you in bills and balances."}
          </p>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Default currency</label>
          {/* v1 is MYR only (CLAUDE.md) — shown as a fixed value, not a real picker. */}
          <div className="rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink">
            RM {SUPPORTED_CURRENCY}
          </div>
        </div>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

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
