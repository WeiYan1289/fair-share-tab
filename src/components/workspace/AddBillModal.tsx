"use client";

import { BillForm } from "@/components/bills/BillForm";
import type { WorkspaceEventMember } from "@/components/workspace/EventWorkspaceBlock";

// Add-bill modal for the desktop group workspace. Wraps the embedded BillForm
// (no page chrome) in the codebase's standard modal frame. On a successful
// save the modal stays open and the parent remounts the form via a bumped
// formKey, so the user can add several bills in a row; the list behind the
// modal refreshes through onSaved.
export function AddBillModal({
  groupId,
  eventId,
  currency,
  members,
  formKey,
  onClose,
  onSaved,
}: {
  groupId: string;
  eventId: string;
  currency: string;
  members: WorkspaceEventMember[];
  formKey: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative flex max-h-[90vh] w-full max-w-[580px] flex-col overflow-hidden rounded-lg bg-white shadow-[0_24px_48px_-16px_rgba(19,46,40,0.28)] dark:bg-dark-card">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="num text-xl text-ink dark:text-dark-text">Add a bill</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-xl text-muted-2 dark:text-dark-muted"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-6 pb-6">
          <BillForm
            key={formKey}
            embedded
            mode="create"
            groupId={groupId}
            eventId={eventId}
            currency={currency}
            members={members}
            onSaved={onSaved}
          />
        </div>
      </div>
    </div>
  );
}
