"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CreateGroupModal } from "@/components/group/CreateGroupModal";

const STEPS = [
  {
    label: "1",
    tint: "bg-mint-tint dark:bg-mint/16",
    color: "text-emerald dark:text-mint",
    title: "Create a group",
    body: "Give it a name — a ski trip, a shared flat, a running tab with your roommates. No email, no password: just create it and you're in.",
  },
  {
    label: "2",
    tint: "bg-sky-tint dark:bg-sky/16",
    color: "text-sky",
    title: "Add friends & bills",
    body: "Share the link so everyone can join. Log bills as they come up — who paid, how much, and how it's split between you.",
  },
  {
    label: "3",
    tint: "bg-gold-tint dark:bg-gold/16",
    color: "text-gold",
    title: "Settle up",
    body: "When it's time to square up, FairShareTab nets every bill down to the fewest possible transfers, so nobody sends more payments than they have to.",
  },
];

const GOOD_TO_KNOW = [
  {
    title: "No passwords, ever",
    body: "Access is by link only. Anyone holding a group's link can view it, and — unless it's a view-only link — add and edit bills too. That's what makes it fast to set up on a trip, but the link is the door key: only share it with people you trust.",
  },
  {
    title: "Splits are exact, down to the cent",
    body: "Split evenly and FairShareTab handles the rounding for you — the odd cent always goes to whoever paid. Or type exact amounts yourself, bill by bill.",
  },
  {
    title: "Nobody's ever deleted",
    body: "Deactivate someone who's left the trip and their history stays intact — every bill they were part of still adds up correctly. Reactivate them anytime.",
  },
];

const ACCESS_MODES = [
  {
    title: "Visiting with a link",
    tint: "bg-sky-tint dark:bg-sky/16",
    color: "text-sky",
    items: [
      "No email, no password — just a name",
      "One group per browser",
      "Sharing the group forward only offers the full-edit link",
    ],
  },
  {
    title: "Registered member",
    tint: "bg-gold-tint dark:bg-gold/16",
    color: "text-gold",
    items: [
      "Create as many groups as you like",
      "A \"My groups\" dashboard to jump back into any of them",
      "Sharing suggests the view-only link first, with edit access still one tap away",
    ],
  },
];

// Standalone marketing/help page — not part of the Screen Spec, added
// so the landing page (P1-01) can stay a single clean hero moment and
// point here for anyone who wants the fuller explanation.
export function TutorialView() {
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      <div className="mx-auto max-w-[720px] px-6 py-10 sm:px-10 sm:py-14">
        <div className="mb-14 flex items-center justify-between">
          <Link href="/">
            <Logo size={24} wordmarkClassName="text-base" />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-[13px] font-bold text-link hover:text-forest dark:text-mint dark:hover:opacity-80"
            >
              ← Back home
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <p className="mb-2.5 text-[12px] font-bold tracking-wide text-muted-2 uppercase">
          How it works
        </p>
        <h1 className="num mb-4 text-[30px] leading-[1.2] text-ink sm:text-[36px] dark:text-dark-text">
          Three steps from &ldquo;who paid for this?&rdquo; to everyone settled.
        </h1>
        <p className="mb-14 max-w-[520px] text-[15px] leading-relaxed text-muted dark:text-dark-muted">
          No spreadsheets, no math in a group chat. Here&apos;s the whole flow, and what
          makes it safe to use with people you trust.
        </p>

        <div className="mb-16 flex flex-col gap-10 sm:gap-12">
          {STEPS.map((step) => (
            <div key={step.label} className="flex gap-5 sm:gap-6">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-base font-extrabold ${step.tint} ${step.color}`}
              >
                {step.label}
              </div>
              <div>
                <p className="mb-1.5 text-[17px] font-bold text-ink dark:text-dark-text">
                  {step.title}
                </p>
                <p className="max-w-[480px] text-[14px] leading-relaxed text-muted dark:text-dark-muted">
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-16 border-t border-ink/8 pt-12 dark:border-white/10">
          <p className="mb-7 text-[12px] font-bold tracking-wide text-muted-2 uppercase">
            Good to know
          </p>
          <div className="flex flex-col gap-7">
            {GOOD_TO_KNOW.map((item) => (
              <div key={item.title} className="rounded-lg bg-white p-5 sm:p-6 dark:bg-dark-card">
                <p className="mb-1.5 text-[14.5px] font-bold text-ink dark:text-dark-text">
                  {item.title}
                </p>
                <p className="max-w-[540px] text-[13.5px] leading-relaxed text-muted dark:text-dark-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-16 border-t border-ink/8 pt-12 dark:border-white/10">
          <p className="mb-2.5 text-[12px] font-bold tracking-wide text-muted-2 uppercase">
            Two ways in
          </p>
          <p className="mb-7 max-w-[540px] text-[14px] leading-relaxed text-muted dark:text-dark-muted">
            An account is entirely optional — a link is still all it takes to visit a group.
            Registering just unlocks a couple of things a link alone can&apos;t.
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {ACCESS_MODES.map((mode) => (
              <div key={mode.title} className="rounded-lg bg-white p-5 sm:p-6 dark:bg-dark-card">
                <span
                  className={`mb-3 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${mode.tint} ${mode.color}`}
                >
                  {mode.title}
                </span>
                <ul className="flex flex-col gap-2">
                  {mode.items.map((item) => (
                    <li
                      key={item}
                      className="text-[13.5px] leading-relaxed text-muted dark:text-dark-muted"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start gap-4 border-t border-ink/8 pt-12 sm:flex-row sm:items-center sm:justify-between dark:border-white/10">
          <div>
            <p className="mb-1 text-[17px] font-bold text-ink dark:text-dark-text">
              Ready to split your first bill?
            </p>
            <p className="text-[13px] text-muted dark:text-dark-muted">
              Takes about ten seconds — just a name.
            </p>
          </div>
          <div className="flex flex-wrap gap-2.5">
            <Link href="/register">
              <Button variant="secondary">Create an account</Button>
            </Link>
            <Button variant="primary" onClick={() => setShowCreateGroup(true)}>
              Create a group
            </Button>
          </div>
        </div>
      </div>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}
