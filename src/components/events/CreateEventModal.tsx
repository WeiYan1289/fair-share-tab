"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { EventDateRangeField } from "@/components/ui/EventDateRangeField";
import { DEFAULT_CURRENCY } from "@/lib/currency";

interface CreateEventModalProps {
  groupId: string;
  onClose: () => void;
}

// Screen Spec P3-04. Members are never chosen here — every active group
// member is included by default server-side (system-design.md §5); trip-
// specific people get added afterward from the event dashboard.
export function CreateEventModal({ groupId, onClose }: CreateEventModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<string>(DEFAULT_CURRENCY);
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/groups/${groupId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          currency,
          startDate: dateRange?.start,
          endDate: dateRange?.end,
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const data = await res.json();
      router.push(`/g/${groupId}/events/${data.event.id}`);
    } catch {
      setError("Couldn't create the event — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[420px] rounded-lg bg-white p-7 shadow-[0_24px_48px_-16px_rgba(19,46,40,0.28)] dark:bg-dark-card">
        <h2 className="num mb-4 text-xl text-ink dark:text-dark-text">Create a new event</h2>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Event name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ski Trip 2026"
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
          />
        </div>

        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Currency</label>
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Dates</label>
          <EventDateRangeField value={dateRange} onChange={setDateRange} />
          <p className="mt-1.5 text-[11px] text-muted-2">
            Optional — pick both a start and end date, or leave both blank.
          </p>
        </div>

        <p className="mb-5 text-[11.5px] leading-relaxed text-muted-2">
          Members come from the group — add trip-specific people from the event dashboard
          afterward.
        </p>

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
            Create event
          </Button>
        </div>
      </div>
    </div>
  );
}
