"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { AuthTabs } from "./AuthTabs";

// Full page reload on success, not a router push — same reasoning as
// CreateGroupModal: the server just set fresh session cookies and the
// destination page needs them.
export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length >= 8 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          res.status === 409
            ? "An account with this email already exists."
            : (data?.error ?? "Couldn't create your account — check your connection and try again."),
        );
        setSubmitting(false);
        return;
      }
      const data: { claimedGroupId: string | null } = await res.json();
      window.location.href = data.claimedGroupId
        ? `/g/${data.claimedGroupId}/events`
        : "/account/groups";
    } catch {
      setError("Couldn't create your account — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg bg-white p-7 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)] sm:p-8 dark:bg-dark-card">
      <AuthTabs active="register" />

      <h1 className="num mb-1.5 text-[22px] text-ink dark:text-dark-text">Create an account</h1>
      <p className="mb-6 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
        Without an account you can make one group per browser. With one, make as many as you
        like and find them all in one place. If you&rsquo;re holding a link to a group you just
        made, it comes with you.
      </p>

      <div className="mb-3.5">
        <label className="mb-1.5 block text-xs font-bold text-muted-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
        />
      </div>

      <div className="mb-1.5">
        <label className="mb-1.5 block text-xs font-bold text-muted-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Choose a password"
          className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
        />
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-2">At least 8 characters.</p>
      </div>

      {error && <p className={cn("mt-3 text-xs text-coral")}>{error}</p>}

      <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit} className="mt-5 w-full text-center">
        Create account
      </Button>
    </div>
  );
}
