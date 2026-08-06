"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface ResetFormProps {
  token: string;
}

export function ResetForm({ token }: ResetFormProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 8 && password === confirm && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      if (!res.ok) {
        // 429 comes back as plain text, not JSON, so it would otherwise fall
        // through to the generic connection message and misdescribe itself.
        const data = res.status === 429 ? null : await res.json().catch(() => null);
        setError(
          res.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : typeof data?.error === "string"
              ? data.error
              : "Couldn't update your password — check your connection and try again.",
        );
        setSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Couldn't update your password — check your connection and try again.");
    }
    setSubmitting(false);
  }

  if (done) {
    return (
      <div className="rounded-lg bg-white p-7 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)] sm:p-8 dark:bg-dark-card">
        <h1 className="num mb-1.5 text-[22px] text-ink dark:text-dark-text">Password updated</h1>
        <p className="mb-6 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
          You&rsquo;ve been signed out everywhere. Log in with your new password to continue.
        </p>
        <Link href="/login">
          <Button variant="primary" className="w-full text-center">
            Log in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-7 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)] sm:p-8 dark:bg-dark-card">
      <h1 className="num mb-1.5 text-[22px] text-ink dark:text-dark-text">Choose a new password</h1>
      <p className="mb-6 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
        Setting a new password signs you out on every device.
      </p>

      <div className="mb-3.5">
        <label className="mb-1.5 block text-xs font-bold text-muted-2">New password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-2">At least 8 characters.</p>
      </div>

      <div className="mb-1.5">
        <label className="mb-1.5 block text-xs font-bold text-muted-2">Confirm new password</label>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Repeat your new password"
          className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
        />
        {mismatch && <p className="mt-1.5 text-[11px] text-coral">Both passwords must match.</p>}
      </div>

      {error && <p className="mt-3 text-xs text-coral">{error}</p>}

      <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit} className="mt-5 w-full text-center">
        Update password
      </Button>
    </div>
  );
}
