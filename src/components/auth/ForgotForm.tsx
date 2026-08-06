"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      // Only a transport-level or malformed-input failure is reported. A
      // valid request always lands on the same confirmation, whether or not
      // the address has an account -- showing "no such account" here would
      // undo the server's whole anti-enumeration stance.
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Too many attempts. Wait a minute and try again."
            : "Couldn't send the reset link — check your connection and try again.",
        );
        setSubmitting(false);
        return;
      }
      setSent(true);
    } catch {
      setError("Couldn't send the reset link — check your connection and try again.");
    }
    setSubmitting(false);
  }

  if (sent) {
    return (
      <div className="rounded-lg bg-white p-7 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)] sm:p-8 dark:bg-dark-card">
        <h1 className="num mb-1.5 text-[22px] text-ink dark:text-dark-text">Check your email</h1>
        <p className="mb-6 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
          If an account exists for that email, we&rsquo;ve sent a reset link. It expires in 30
          minutes and can only be used once.
        </p>
        <Link href="/login">
          <Button variant="secondary" className="w-full text-center">
            Back to log in
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-7 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)] sm:p-8 dark:bg-dark-card">
      <h1 className="num mb-1.5 text-[22px] text-ink dark:text-dark-text">Reset your password</h1>
      <p className="mb-6 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
        Enter the email on your account and we&rsquo;ll send you a link to choose a new password.
      </p>

      <div className="mb-1.5">
        <label className="mb-1.5 block text-xs font-bold text-muted-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="you@example.com"
          className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
        />
      </div>

      {error && <p className="mt-3 text-xs text-coral">{error}</p>}

      <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit} className="mt-5 w-full text-center">
        Send reset link
      </Button>

      <Link
        href="/login"
        className="mt-4 block text-center text-xs text-muted hover:text-ink dark:text-dark-muted dark:hover:text-dark-text"
      >
        Back to log in
      </Link>
    </div>
  );
}
