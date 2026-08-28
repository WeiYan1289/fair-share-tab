"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CreateGroupModal } from "@/components/group/CreateGroupModal";
import { SettleUpHero } from "@/components/landing/SettleUpHero";
import { Receipt, Coins, Scale, Archive, Eye, Lock, type LucideIcon } from "lucide-react";

// Screen Spec P1-01, redesigned (Claude Design "Direction B (dense)"). The
// old landing was one hero moment with everything else deferred to
// /tutorial; visitors arriving cold had no way to judge the product from the
// page itself. This version keeps the hero moment and adds, in order: real
// product screenshots, the one-page desktop workspace, the four steps, the
// before/after that the settlement engine actually produces, the feature
// rows, the role matrix, and an FAQ. /tutorial still exists and stays the
// long-form explanation — every section here links into it.
//
// Every colour is a tailwind.config.ts token. No hex values.

const STEPS = [
  {
    n: "Step 1",
    color: "text-emerald dark:text-mint",
    title: "Create a group",
    body: "Name it and you're in. The link you get back is the whole account.",
  },
  {
    n: "Step 2",
    color: "text-sky-text dark:text-sky",
    title: "Start an event",
    body: "One trip, one currency, one running total. Everyone joins automatically.",
  },
  {
    n: "Step 3",
    color: "text-gold",
    title: "Log bills",
    body: "Who paid, how much, split evenly or exactly. Receipt optional.",
  },
  {
    n: "Step 4",
    color: "text-emerald dark:text-mint",
    title: "Settle up",
    body: "Fewest possible transfers, marked paid, locked for good.",
  },
];

// The transfers the engine produces for the hero's worked example — same
// figures as SettleUpHero, so the two agree on screen.
const RAW_IOUS = [
  ["Aisyah → Priya", "RM 320.00"],
  ["Aisyah → Jian", "RM 110.00"],
  ["Kamal → Priya", "RM 70.00"],
  ["Kamal → Siti", "RM 180.00"],
];

const SETTLED = [
  ["Aisyah → Priya", "RM 500.00"],
  ["Kamal → Jian", "RM 250.00"],
  ["Hafiz → Siti", "RM 100.00"],
  ["Devi → Jian", "RM 100.00"],
  ["Nadia → Siti", "RM 50.00"],
];

// Each feature carries a meaningful icon rendered in its accent colour: the
// pale tint square alone was invisible against the cream page in light mode,
// so the marker now reads as an icon, not a blank swatch.
const FEATURES: { icon: LucideIcon; tint: string; title: string; body: string }[] = [
  {
    icon: Receipt,
    tint: "bg-gold-tint text-gold dark:bg-gold/16 dark:text-gold",
    title: "Receipts on the bill",
    body: "Attach a photo; it's compressed in your browser and stored with the bill. If it fails, the bill still saves.",
  },
  {
    icon: Coins,
    tint: "bg-sky-tint text-sky-text dark:bg-sky/16 dark:text-sky",
    title: "Thirteen currencies",
    body: "Ringgit to yen, one per event. Currencies without decimals are stored without them.",
  },
  {
    icon: Scale,
    tint: "bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint",
    title: "Exact to the cent",
    body: "RM 250 across three is 83.34 / 83.33 / 83.33. The odd cent goes to whoever paid — it's never dropped.",
  },
  {
    icon: Archive,
    tint: "bg-coral-tint text-coral dark:bg-coral/16 dark:text-coral",
    title: "Archive, never delete",
    body: "People, events and groups are archived, not removed. Restore brings back the share links too.",
  },
  {
    icon: Eye,
    tint: "bg-sky-tint text-sky-text dark:bg-sky/16 dark:text-sky",
    title: "View-only sharing",
    body: "One link to look, one link to edit. Which is which is checked on the server on every request.",
  },
  {
    icon: Lock,
    tint: "bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint",
    title: "Settled stays settled",
    body: "Confirmed transfers lock their bills read-only, so the history is safe to screenshot into the group chat.",
  },
];

// Mirrors TutorialView's ROLES/ABILITIES exactly. If the access rules change,
// both tables are wrong and must change together.
const ABILITIES: { label: string; can: [boolean, boolean, boolean] }[] = [
  { label: "see every event, bill and balance", can: [true, true, true] },
  { label: "add and edit bills, members and events", can: [false, true, true] },
  { label: "settle up an event", can: [false, true, true] },
  { label: "rename, archive or restore the group", can: [false, false, true] },
  { label: "hold more than one group at a time", can: [false, false, true] },
];

const FAQ = [
  {
    q: "Do I really not need an account?",
    a: "Really. A group is a link, and whoever holds it is in. An account is free, optional, and lets you keep more than one group.",
  },
  {
    q: "Can one event mix currencies?",
    a: "No. One event, one currency — so there's never a conversion to argue about when you settle.",
  },
  {
    q: "What if someone leaves the trip?",
    a: "Deactivate them. They stay on every bill they were part of, everything still adds up, and you can reactivate them anytime.",
  },
  {
    q: "Can I undo a settle-up?",
    a: "No. Confirming locks those bills for good — that's what makes the history worth trusting, so it asks you to tick that the payments really happened.",
  },
];

export function Landing() {
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      {/* Nav sits on forest so the cream page below reads as the content
          surface, and so the primary CTA is visible before any scroll. */}
      <div className="bg-forest px-4 dark:bg-dark-card sm:px-6">
        <div className="mx-auto flex h-15 max-w-[1000px] items-center justify-between gap-2 py-3.5">
          <Logo
            size={24}
            wordmarkClassName="text-[15px] [&>span:first-child]:text-cream [&>span:last-child]:text-mint sm:text-[16.5px]"
          />
          <div className="flex items-center gap-3 sm:gap-5">
            <a href="#how" className="hidden text-[12.5px] font-bold text-cream/70 hover:text-cream sm:block">
              How it works
            </a>
            <a href="#maths" className="hidden text-[12.5px] font-bold text-cream/70 hover:text-cream sm:block">
              The maths
            </a>
            <a href="#faq" className="hidden text-[12.5px] font-bold text-cream/70 hover:text-cream sm:block">
              FAQ
            </a>
            <Link
              href="/login"
              className="flex h-[30px] shrink-0 items-center text-[12px] font-bold whitespace-nowrap text-cream/85 hover:text-cream sm:rounded-full sm:border sm:border-white/22 sm:px-3.5"
            >
              Log in
            </Link>
            <button
              type="button"
              onClick={() => setShowCreateGroup(true)}
              className="shrink-0 rounded-full bg-mint px-3.5 py-1.5 text-[12px] font-bold whitespace-nowrap text-dark-bg transition-opacity hover:opacity-90 sm:px-4 sm:py-2"
            >
              Create a group
            </button>
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1000px] px-6 pt-11 pb-14 sm:px-10">
        {/* Hero */}
        <div className="mb-5 flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-11">
          <div className="lg:max-w-[430px] lg:flex-1">
            <h1 className="num mb-3.5 text-[30px] leading-[1.1] tracking-[-0.022em] text-balance text-ink sm:text-[40px] dark:text-dark-text">
              A fortnight of &ldquo;I&apos;ll get this one&rdquo;, untangled in one tap.
            </h1>
            <p className="mb-5 text-[15px] leading-relaxed text-muted dark:text-dark-muted">
              Log every bill as it happens. FairShareTab keeps the balances straight and turns
              the whole mess into the shortest possible list of payments.
            </p>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                variant="primary"
                onClick={() => setShowCreateGroup(true)}
                className="w-full sm:w-auto"
              >
                Create a group — it&apos;s free
              </Button>
              <Link href="/tutorial" className="w-full sm:w-auto">
                <Button variant="secondary" className="w-full py-3.5 text-[14.5px] sm:w-auto">
                  See how it works
                </Button>
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              <Chip className="bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint">No sign-up</Chip>
              <Chip className="bg-sky-tint text-sky-text dark:bg-sky/16 dark:text-sky">13 currencies</Chip>
              <Chip className="bg-gold-tint text-gold dark:bg-gold/16 dark:text-gold">Receipts attached</Chip>
              <Chip className="bg-coral-tint text-coral dark:bg-coral/16 dark:text-coral">Nothing ever deleted</Chip>
            </div>
          </div>
          <div className="lg:flex-1">
            <SettleUpHero />
          </div>
        </div>

        {/* Product shot, bleeding off the bottom of its frame: the page
            continues into the app rather than presenting a finished poster.
            The phone overlays it so the mobile layout is visible without a
            second section. */}
        <div className="relative mb-11">
          {/* Phones get the actual phone view of the app, bleeding off the
              bottom of its frame — not a shrunken desktop dashboard. */}
          <div className="rounded-t-lg border border-b-0 border-ink/8 bg-white p-2 pb-0 sm:hidden dark:border-white/8 dark:bg-dark-card">
            <div className="max-h-[360px] overflow-hidden rounded-t-md bg-cream dark:bg-dark-bg">
              <img
                src="/home/hero-mobile.png"
                alt="An event dashboard on a phone, showing members and balances"
                className="block w-full dark:hidden"
              />
              <img
                src="/home/hero-mobile-dark.png"
                alt="An event dashboard on a phone, showing members and balances"
                className="hidden w-full dark:block"
              />
            </div>
          </div>
          {/* Desktop: the wide dashboard band with a phone overlaid. */}
          <div className="hidden rounded-t-lg border border-b-0 border-ink/8 bg-white p-3 pb-0 sm:block dark:border-white/8 dark:bg-dark-card">
            <div className="h-[300px] overflow-hidden rounded-t-md bg-cream dark:bg-dark-bg">
              <img
                src="/home/hero-dashboard.png"
                alt="An event dashboard showing members, balances and bills"
                className="block w-full dark:hidden"
              />
              <img
                src="/home/hero-dashboard-dark.png"
                alt="An event dashboard showing members, balances and bills"
                className="hidden w-full dark:block"
              />
            </div>
          </div>
          <div className="absolute right-6 -bottom-4 hidden w-[168px] overflow-hidden rounded-[22px] border-[6px] border-ink bg-ink shadow sm:block dark:border-dark-bg dark:bg-dark-bg">
            <div className="relative h-[280px] overflow-hidden rounded-2xl">
              <img
                src="/home/hero-phone.png"
                alt="Settling up on a phone"
                className="absolute inset-0 block h-full w-full object-cover object-top dark:hidden"
              />
              <img
                src="/home/hero-phone-dark.png"
                alt="Settling up on a phone"
                className="absolute inset-0 hidden h-full w-full object-cover object-top dark:block"
              />
            </div>
          </div>
        </div>

        {/* One-page desktop workspace — the flagship desktop experience, added
            to the redesign so the "latest UI" is on the page, not just named. */}
        <div className="mb-11">
          <div className="mb-4">
            <p className="mb-1 text-xs font-bold tracking-wide text-sky-text uppercase dark:text-sky">
              On a big screen
            </p>
            <p className="text-[18px] font-bold text-ink sm:text-[20px] dark:text-dark-text">
              The whole group on one page
            </p>
            <p className="mt-1.5 max-w-[560px] text-[13.5px] leading-relaxed text-muted dark:text-dark-muted">
              On desktop, every event, its bills, balances and a live settle-up preview sit on a
              single workspace. Add a bill or square up without ever leaving the page.
            </p>
          </div>
          <div className="overflow-hidden rounded-lg border border-ink/8 bg-white p-2 shadow-[0_20px_44px_-24px_rgba(19,46,40,0.22)] dark:border-white/8 dark:bg-dark-card dark:shadow-[0_20px_44px_-24px_rgba(0,0,0,0.6)]">
            <img
              src="/home/workspace-desktop.png"
              alt="The one-page desktop workspace showing a group's events, bills, balances and a live settle-up preview"
              className="block w-full rounded-md dark:hidden"
            />
            <img
              src="/home/workspace-desktop-dark.png"
              alt="The one-page desktop workspace showing a group's events, bills, balances and a live settle-up preview"
              className="hidden w-full rounded-md dark:block"
            />
          </div>
        </div>

        {/* Four steps */}
        <div
          id="how"
          className="mb-11 grid grid-cols-1 gap-5 border-y border-ink/10 py-7 sm:grid-cols-2 lg:grid-cols-4 dark:border-white/10"
        >
          {STEPS.map((step) => (
            <div key={step.n}>
              <p className={`mb-1 text-xs font-bold tracking-wide uppercase ${step.color}`}>{step.n}</p>
              <p className="mb-1 text-[15px] font-bold text-ink dark:text-dark-text">{step.title}</p>
              <p className="text-[12.5px] leading-snug text-muted dark:text-dark-muted">{step.body}</p>
            </div>
          ))}
        </div>

        {/* Before / after — the settlement engine's actual output */}
        <div id="maths" className="mb-11 flex flex-col gap-8 lg:flex-row">
          <div className="flex-1 rounded-lg bg-white p-6 dark:bg-dark-card">
            <p className="mb-2.5 text-xs font-bold tracking-wide text-coral uppercase">Before</p>
            <p className="mb-3.5 text-[13.5px] leading-relaxed text-muted dark:text-dark-muted">
              Five people, a fortnight of covering for each other, twelve separate IOUs nobody
              wants to unpick.
            </p>
            <div className="flex flex-col gap-1.5">
              {RAW_IOUS.map(([who, amount]) => (
                <div
                  key={who}
                  className="flex justify-between rounded-[10px] bg-coral-tint px-3 py-1.5 text-[13px] text-muted dark:bg-coral/16 dark:text-dark-muted"
                >
                  <span>{who}</span>
                  <span className="num text-[13px]">{amount}</span>
                </div>
              ))}
              <p className="mt-1 text-xs text-muted-2">…and eight more.</p>
            </div>
          </div>
          <div className="flex-1 rounded-lg bg-white p-6 dark:bg-dark-card">
            <p className="mb-2.5 text-xs font-bold tracking-wide text-emerald uppercase dark:text-mint">
              After
            </p>
            <p className="mb-3.5 text-[13.5px] leading-relaxed text-muted dark:text-dark-muted">
              Every balance nets to the same figure it always was. Only the list of who pays whom
              gets shorter.
            </p>
            <div className="flex flex-col gap-1.5">
              {SETTLED.map(([who, amount]) => (
                <div
                  key={who}
                  className="flex justify-between rounded-[10px] bg-mint-tint px-3 py-1.5 text-[13px] text-ink dark:bg-mint/16 dark:text-dark-text"
                >
                  <span>{who}</span>
                  <span className="num text-[13px]">{amount}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="mb-11 grid gap-3.5 sm:grid-cols-2 sm:gap-x-8">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] ${f.tint}`}
              >
                <f.icon className="h-4 w-4" strokeWidth={2.25} aria-hidden="true" />
              </div>
              <div>
                <p className="mb-0.5 text-sm font-bold text-ink dark:text-dark-text">{f.title}</p>
                <p className="text-[12.5px] leading-snug text-muted dark:text-dark-muted">{f.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Roles. Same data as TutorialView's RoleMatrix, one card per role
            below sm for the same reason it does. */}
        <div className="mb-11 overflow-hidden rounded-lg bg-white dark:bg-dark-card">
          <div className="px-6 pt-5 pb-1">
            <p className="mb-0.5 text-[15px] font-bold text-ink dark:text-dark-text">
              Three ways in, and what each one can do
            </p>
            <p className="text-[12.5px] text-muted dark:text-dark-muted">
              The link you were sent decides. An account is optional, and only ever adds.
            </p>
          </div>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-ink/8 dark:border-white/10">
                <th className="w-1/2 px-6 py-3 text-[12.5px] font-bold text-muted-2">Can they&hellip;</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-sky-text dark:text-sky">
                  View-only link
                </th>
                <th className="px-2 py-3 text-center text-xs font-bold text-gold">Editor link</th>
                <th className="px-2 py-3 text-center text-xs font-bold text-emerald dark:text-mint">
                  Account
                </th>
              </tr>
            </thead>
            <tbody className="text-[13px]">
              {ABILITIES.map((ability) => (
                <tr
                  key={ability.label}
                  className="border-b border-ink/6 last:border-0 dark:border-white/6"
                >
                  <th
                    scope="row"
                    className="px-6 py-2.5 text-left text-[13px] font-normal text-ink dark:text-dark-text"
                  >
                    {ability.label}
                  </th>
                  {ability.can.map((allowed, i) => (
                    <td key={i} className="px-2 py-2.5 text-center">
                      {allowed ? (
                        <span className="font-bold text-emerald dark:text-mint" aria-label="Yes">
                          ✓
                        </span>
                      ) : (
                        <span className="text-muted-2" aria-label="No">
                          —
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* FAQ */}
        <div id="faq" className="grid gap-4.5 sm:grid-cols-2 sm:gap-x-8">
          {FAQ.map((item) => (
            <div key={item.q} className="border-l-2 border-mint pl-3.5">
              <p className="mb-1 text-sm font-bold text-ink dark:text-dark-text">{item.q}</p>
              <p className="text-[13px] leading-relaxed text-muted dark:text-dark-muted">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Closing CTA + footer, on forest so the page ends where the nav
          started. */}
      <div className="bg-forest px-6 pt-9 pb-6 text-cream sm:px-10 dark:bg-dark-card">
        <div className="mx-auto max-w-[1000px]">
          <div className="flex flex-col items-start gap-6 border-b border-white/12 pb-7 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mb-1 text-[22px] font-bold">Split your first bill in about ten seconds.</p>
              <p className="text-[13.5px] text-cream/70">
                Just a name — no email, no password, nothing to confirm.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/register">
                <button
                  type="button"
                  className="rounded-md border border-white/22 px-5 py-[11px] text-[13.5px] font-bold text-cream"
                >
                  Create an account
                </button>
              </Link>
              <button
                type="button"
                onClick={() => setShowCreateGroup(true)}
                className="rounded-md bg-mint px-6 py-3.5 text-[14.5px] font-bold text-dark-bg transition-opacity hover:opacity-90"
              >
                Create a group
              </button>
            </div>
          </div>
          <div className="flex flex-col justify-between gap-8 pt-6 sm:flex-row">
            <p className="max-w-[260px] text-[12.5px] leading-relaxed text-cream/60">
              Split group trip costs fairly, then settle up in the fewest possible transfers.
            </p>
            <div>
              <p className="mb-2.5 text-[11.5px] font-bold tracking-wide text-cream/45 uppercase">
                Product
              </p>
              <div className="flex flex-col gap-1.5 text-[13px]">
                <Link href="/tutorial" className="text-cream/80 hover:text-cream">
                  How it works
                </Link>
                <button
                  type="button"
                  onClick={() => setShowCreateGroup(true)}
                  className="text-left text-cream/80 hover:text-cream"
                >
                  Create a group
                </button>
                <Link href="/login" className="text-cream/80 hover:text-cream">
                  Log in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}

function Chip({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <span className={`rounded-full px-2.5 py-[5px] text-[11.5px] font-bold ${className}`}>
      {children}
    </span>
  );
}
