"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface NewMember {
  id: string;
  name: string;
  avatarColor: string;
  isActive: boolean;
  createdAt: string;
  balance: number;
}

interface AddMemberModalProps {
  eventId: string;
  onClose: () => void;
  onAdded: (member: NewMember) => void;
}

// Screen Spec P4-04, add-member state. Writes a brand-new Member and
// attaches them to this event (POST /api/events/{id}/members) -- members
// are never picked from an existing pool here, only created.
export function AddMemberModal({ eventId, onClose, onAdded }: AddMemberModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleAdd() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/events/${eventId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim() || undefined }),
      });
      if (!res.ok) throw new Error("create failed");
      const data = await res.json();
      onAdded({ ...data.member, balance: 0 });
    } catch {
      setError("Couldn't add that member — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg">
        <h2 className="num mb-4.5 text-xl text-ink sm:text-[22px]">Add a member</h2>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Name</label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Emma Torres"
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest"
          />
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">
            Email <span className="font-normal text-muted-2">(optional, for invites)</span>
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="emma@email.com"
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest"
          />
        </div>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSubmit}
            onClick={handleAdd}
            className="flex-1 text-center"
          >
            Add member
          </Button>
        </div>
      </div>
    </div>
  );
}
