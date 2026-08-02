"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { MAX_MEMBER_NAME_LENGTH } from "@/lib/constants";

interface NewMember {
  id: string;
  name: string;
  avatarColor: string;
  isActive: boolean;
  createdAt: string;
  balance: number;
}

type AddMemberScope = { type: "event"; eventId: string } | { type: "group"; groupId: string };

interface AddMemberModalProps {
  scope: AddMemberScope;
  onClose: () => void;
  onAdded: (member: NewMember) => void;
}

// Screen Spec P4-04, add-member state (event scope) / P3-02 (group scope,
// session-persistence-and-ownership design §6). Writes a brand-new Member
// and, for event scope only, attaches them to that event in the same
// request (POST /api/events/{id}/members) -- members are never picked from
// an existing pool here, only created. Group scope posts to
// POST /api/groups/{id}/members instead, which creates the member with no
// event attachment at all.
export function AddMemberModal({ scope, onClose, onAdded }: AddMemberModalProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleAdd() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    const endpoint =
      scope.type === "event"
        ? `/api/events/${scope.eventId}/members`
        : `/api/groups/${scope.groupId}/members`;

    try {
      const res = await fetch(endpoint, {
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
      <div className="relative w-full max-w-[400px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-4.5 text-xl text-ink sm:text-[22px] dark:text-dark-text">
          Add a member
        </h2>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Name</label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Emma Torres"
            maxLength={MAX_MEMBER_NAME_LENGTH}
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
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
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
          />
        </div>

        {scope.type === "group" && (
          <p className="mb-5 text-[12px] leading-relaxed text-muted dark:text-dark-muted">
            They&apos;ll join the group. Add them to a trip to include them in its bills.
          </p>
        )}

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
