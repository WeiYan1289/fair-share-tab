"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
    href: "/tutorial/group",
    // Desktop keeps the full page (modal over the landing hero); mobile
    // uses a tightly cropped shot of just the modal card -- the dimmed
    // backdrop around it was mostly wasted space on a small screen. All 4
    // mobile thumbnails render at the same 65% width regardless (below).
    screenshot: { src: "/tutorial/create-group.png", mobileSrc: "/tutorial/mobile/create-group-modal.png" },
  },
  {
    label: "2",
    tint: "bg-sky-tint dark:bg-sky/16",
    color: "text-sky",
    title: "Start an event",
    body: "Each trip or occasion gets its own event, with its own currency and its own running total — every group member joins automatically.",
    href: "/tutorial/event",
    screenshot: { src: "/tutorial/create-event.png", mobileSrc: "/tutorial/mobile/create-event-modal.png" },
  },
  {
    label: "3",
    tint: "bg-gold-tint dark:bg-gold/16",
    color: "text-gold",
    title: "Log bills",
    body: "Add bills as they come up — who paid, how much, and how it's split. Split evenly or type exact amounts, bill by bill.",
    href: "/tutorial/bill",
    screenshot: { src: "/tutorial/add-bill-equal.png", mobileSrc: "/tutorial/mobile/add-bill-equal.png" },
  },
  {
    label: "4",
    tint: "bg-mint-tint dark:bg-mint/16",
    color: "text-emerald dark:text-mint",
    title: "Settle up",
    body: "When it's time to square up, FairShareTab nets every bill down to the fewest possible transfers, so nobody sends more payments than they have to.",
    href: "/tutorial/settle-up",
    screenshot: { src: "/tutorial/settle-select.png", mobileSrc: "/tutorial/mobile/settle-select.png" },
  },
];

const GOOD_TO_KNOW = [
  {
    title: "No passwords, ever",
    body: "Access is by link only. Anyone holding a group's link can view it, and — unless it's a view-only link — add and edit bills too. That's what makes it fast to set up on a trip, but the link is the door key: only share it with people you trust.",
  },
  {
    title: "Nobody's ever deleted",
    body: "Deactivate someone who's left the trip and their history stays intact — every bill they were part of still adds up correctly. Reactivate them anytime.",
  },
];

// Standalone marketing/help page — not part of the Screen Spec, added
// so the landing page (P1-01) can stay a single clean hero moment and
// point here for anyone who wants the fuller explanation.
export function TutorialView() {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const router = useRouter();
  const embedded = useSearchParams().get("embedded") === "1";

  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      <div className="mx-auto max-w-[720px] px-6 py-10 sm:px-10 sm:py-14">
        <div className="mb-5 flex items-center justify-between sm:mb-6">
          {embedded ? (
            <Logo size={24} wordmarkClassName="text-base" />
          ) : (
            <Link href="/">
              <Logo size={24} wordmarkClassName="text-base" />
            </Link>
          )}
          <div className="flex items-center gap-3.5">
            {!embedded && (
              <Link
                href="/login"
                className="flex h-9 items-center rounded-full border border-ink/14 bg-white px-4 text-[12.5px] font-bold text-ink transition-colors hover:bg-cream-hover dark:border-white/14 dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-bg"
              >
                Log in
              </Link>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* Own row, like every other "back to where you were" link in the
            app (EventDashboard's "← All events", MemberExpenseView's
            "← Back"), instead of crammed into the logo/controls row above --
            that's what made this wrap into "← Back / home" on narrow phones. */}
        <div className="mb-8 sm:mb-14">
          {embedded ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="text-[13px] font-bold text-link hover:text-forest dark:text-mint dark:hover:opacity-80"
            >
              ← Back
            </button>
          ) : (
            <Link
              href="/"
              className="text-[13px] font-bold text-link hover:text-forest dark:text-mint dark:hover:opacity-80"
            >
              ← Back home
            </Link>
          )}
        </div>

        <p className="mb-2.5 text-[12px] font-bold tracking-wide text-muted-2 uppercase">
          How it works
        </p>
        <h1 className="num mb-3 text-[24px] leading-[1.25] text-ink sm:mb-4 sm:text-[36px] sm:leading-[1.2] dark:text-dark-text">
          Four steps from &ldquo;who paid for this?&rdquo; to everyone settled.
        </h1>
        <p className="mb-8 max-w-[520px] text-[14px] leading-relaxed text-muted sm:mb-14 sm:text-[15px] dark:text-dark-muted">
          No spreadsheets, no math in a group chat. Here&apos;s the whole flow, and what
          makes it safe to use with people you trust.
        </p>

        <div className="mb-10 flex flex-col gap-8 sm:mb-16 sm:gap-14">
          {STEPS.map((step) => (
            <div key={step.label} className="flex flex-col gap-4 sm:flex-row sm:gap-6">
              <div className="flex gap-4 sm:gap-6">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] text-base font-extrabold ${step.tint} ${step.color}`}
                >
                  {step.label}
                </div>
                <div className="sm:hidden">
                  <p className="mb-1 text-[16px] font-bold text-ink dark:text-dark-text">
                    {step.title}
                  </p>
                  <p className="max-w-[480px] text-[13px] leading-relaxed text-muted dark:text-dark-muted">
                    {step.body}
                  </p>
                </div>
              </div>
              <div className="flex-1">
                <div className="mb-1.5 hidden sm:block">
                  <p className="mb-1.5 text-[17px] font-bold text-ink dark:text-dark-text">
                    {step.title}
                  </p>
                  <p className="max-w-[480px] text-[14px] leading-relaxed text-muted dark:text-dark-muted">
                    {step.body}
                  </p>
                </div>
                {/* Embedded mode strips these deliberately. The detail pages
                    (TutorialDetailView) have no embedded awareness — they show
                    a "Log in" button, an account CTA footer, and a "← Back to
                    tutorial" that lands on the non-embedded /tutorial — so
                    linking out would strand someone who tapped "?" inside
                    their own group with no way back. */}
                {!embedded && (
                  <Link href={step.href} className="mt-3 block max-w-[420px]">
                    {/* Same white/dark-card mat + shadow as TutorialDetailView's
                        full-size screenshots -- the thumbnail's own bg-cream
                        background otherwise disappears into this page's
                        identical background in light mode. */}
                    <div className="mx-auto max-w-[65%] rounded-lg bg-white p-1.5 shadow-[0_16px_32px_-18px_rgba(19,46,40,0.18)] sm:mx-0 sm:max-w-none dark:bg-dark-card dark:shadow-[0_16px_32px_-18px_rgba(0,0,0,0.55)]">
                      <picture>
                        <source media="(min-width: 640px)" srcSet={step.screenshot.src} />
                        <img
                          src={step.screenshot.mobileSrc}
                          alt={`${step.title} in FairShareTab`}
                          loading="lazy"
                          className="h-auto w-full rounded-md"
                        />
                      </picture>
                    </div>
                    <span className="mt-2 inline-block text-[13px] font-bold text-link dark:text-mint">
                      See the full walkthrough →
                    </span>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-10 border-t border-ink/8 pt-8 sm:mb-16 sm:pt-12 dark:border-white/10">
          <p className="mb-4 text-[12px] font-bold tracking-wide text-muted-2 uppercase sm:mb-7">
            Good to know
          </p>
          <div className="flex flex-col gap-4 sm:gap-7">
            {GOOD_TO_KNOW.map((item) => (
              <div key={item.title} className="rounded-lg bg-white p-4 sm:p-6 dark:bg-dark-card">
                <p className="mb-1 text-[14px] font-bold text-ink sm:mb-1.5 sm:text-[14.5px] dark:text-dark-text">
                  {item.title}
                </p>
                <p className="max-w-[540px] text-[13px] leading-relaxed text-muted sm:text-[13.5px] dark:text-dark-muted">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-10 border-t border-ink/8 pt-8 sm:mb-16 sm:pt-12 dark:border-white/10">
          <p className="mb-2.5 text-[12px] font-bold tracking-wide text-muted-2 uppercase">
            Two ways in
          </p>
          <p className="max-w-[560px] text-[13px] leading-relaxed text-muted sm:text-[14px] dark:text-dark-muted">
            An account is entirely optional — a link is still all it takes to visit a group,
            with no email or password, though it limits you to one group per browser.
            Registering lets you create and jump between as many groups as you like, and
            suggests the view-only link first when you share — full edit access is still one
            tap away either way.
          </p>
        </div>

        {!embedded && (
          <div className="flex flex-col items-start gap-4 border-t border-ink/8 pt-8 sm:flex-row sm:items-center sm:justify-between sm:pt-12 dark:border-white/10">
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
        )}
      </div>

      {!embedded && showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}
    </div>
  );
}
