"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.trim().length > 0 && password.length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) {
        setError("Invalid email or password.");
        setSubmitting(false);
        return;
      }
      // Full page reload, not a router push — the server just set
      // fst_user_session and /account/groups reads it server-side.
      window.location.href = "/account/groups";
    } catch {
      setError("Couldn't log in — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-lg bg-white p-7 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)] sm:p-8 dark:bg-dark-card">
      <h1 className="num mb-1.5 text-[22px] text-ink dark:text-dark-text">Log in</h1>
      <p className="mb-6 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
        For registered members only — a group link never needs this.
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
          placeholder="Your password"
          className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
        />
      </div>

      {error && <p className="mt-3 text-xs text-coral">{error}</p>}

      <Button variant="primary" disabled={!canSubmit} onClick={handleSubmit} className="mt-5 w-full text-center">
        Log in
      </Button>

      <p className="mt-5 text-center text-[12.5px] text-muted dark:text-dark-muted">
        New here?{" "}
        <Link href="/register" className="font-bold text-link hover:opacity-80 dark:text-mint">
          Create an account
        </Link>
      </p>
    </div>
  );
}
