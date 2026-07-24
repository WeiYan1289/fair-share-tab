"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

/** Everything after the last "/g/" segment, or a bare token-shaped paste. */
function extractToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const gIndex = trimmed.lastIndexOf("/g/");
  if (gIndex !== -1) {
    const candidate = trimmed.slice(gIndex + 3).split(/[?#/]/)[0];
    return candidate.length > 0 ? candidate : null;
  }

  return /^[0-9A-Za-z]{10,}$/.test(trimmed) ? trimmed : null;
}

// Screen Spec P1-03. Inline expansion of P1-01 -- client-side format check
// only (empty / valid / invalid); the server is the real authority once
// Continue navigates to /g/{token}.
export function PasteLinkPanel({ className }: { className?: string }) {
  const [value, setValue] = useState("");

  const token = extractToken(value);
  const isEmpty = value.trim().length === 0;
  const isInvalid = !isEmpty && !token;

  return (
    <div
      className={cn(
        "max-w-[420px] rounded-lg border border-ink/8 bg-white p-6 shadow-[0_16px_36px_-20px_rgba(19,46,40,0.22)] dark:border-white/8 dark:bg-dark-card",
        className,
      )}
    >
      <p className="mb-2 text-xs font-bold text-muted-2">Paste your invite link</p>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="fairsharetab.app/g/..."
        className={cn(
          "mb-2 w-full rounded-md border-[1.5px] bg-cream px-3.5 py-3 text-[13px] text-ink outline-none dark:bg-dark-bg dark:text-dark-text",
          isInvalid ? "border-coral" : "border-emerald dark:border-mint",
        )}
      />
      {isInvalid && (
        <p className="mb-3.5 text-xs text-coral">
          This doesn&apos;t look like a FairShareTab link — check it and try again.
        </p>
      )}
      <Button
        variant="primary"
        disabled={!token}
        className="w-full !px-4 !py-3.5 text-center text-sm"
        onClick={() => {
          if (token) window.location.href = `/g/${token}`;
        }}
      >
        Continue
      </Button>
    </div>
  );
}
