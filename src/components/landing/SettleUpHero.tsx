"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

// Five payers settling up with three receivers in just five transfers —
// deliberately more people than the old 3-payer mock, to show the
// settlement engine collapsing a genuinely tangled bill history down to a
// handful of transfers. Amounts are hand-picked so a greedy max-debtor/
// max-creditor match (the real algorithm, see docs/system-design.md §4.4)
// produces exactly this set: AR->PS 500, KM->JI 250, HZ->SM 100,
// DV->JI 100, NF->SM 50 — each side sums to 1000.
const PAYERS = [
  { initials: "AR", color: "#B5654A", top: "8%", y: 24, amount: "RM 500" },
  { initials: "KM", color: "#7A5C9E", top: "26%", y: 78, amount: "RM 250" },
  { initials: "HZ", color: "#3E7C86", top: "44%", y: 132, amount: "RM 100" },
  { initials: "DV", color: "#B98A2E", top: "62%", y: 186, amount: "RM 100" },
  { initials: "NF", color: "#6B7280", top: "80%", y: 240, amount: "RM 50" },
];

const RECEIVERS = [
  { initials: "PS", color: "#2F7FB8", top: "15%", y: 45 },
  { initials: "JI", color: "#1F9E68", top: "50%", y: 150 },
  { initials: "SM", color: "#B54A6A", top: "85%", y: 255 },
];

// The settled result: the five curves that survive the collapse.
const TRANSFERS = [
  "M80,24 Q212,10 345,45",
  "M80,78 Q212,70 345,150",
  "M80,132 Q212,150 345,255",
  "M80,186 Q212,200 345,150",
  "M80,240 Q212,260 345,255",
];

// The "before": twelve raw IOUs, every payer owing several people, which is
// what a fortnight of someone-covers-it actually leaves you with. Straight
// lines on purpose — the tangle should look like arithmetic nobody wants to
// do, against the curves' deliberate calm.
const RAW_DEBTS = PAYERS.flatMap((payer, i) =>
  RECEIVERS.filter((_, j) => (i + j) % 4 !== 3).map(
    (receiver) => `M80,${payer.y} L345,${receiver.y}`,
  ),
);

// The same five settled transfers as a list — the phone can't read a
// crossing-lines graph at 340px wide, so mobile gets the settle-up result the
// way the app itself shows it: one clean row per payment.
const SETTLED_TRANSFERS = [
  { from: PAYERS[0], to: RECEIVERS[0], amount: "RM 500" },
  { from: PAYERS[1], to: RECEIVERS[1], amount: "RM 250" },
  { from: PAYERS[2], to: RECEIVERS[2], amount: "RM 100" },
  { from: PAYERS[3], to: RECEIVERS[1], amount: "RM 100" },
  { from: PAYERS[4], to: RECEIVERS[2], amount: "RM 50" },
];

const COLLAPSE_DELAY_MS = 1100;

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
      style={{ backgroundColor: color }}
    >
      {initials}
    </span>
  );
}

// The landing page's one moment: the product is the collapse, so the hero
// performs it rather than describing it. Everything is settled state under
// prefers-reduced-motion, and the settled state is also what renders on the
// server — the tangle is additive, never a prerequisite for reading the page.
export function SettleUpHero() {
  const [settled, setSettled] = useState(true);
  // Mobile list rows cascade in on mount; defaults to shown so the content is
  // there without JS and under reduced motion.
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setEntered(true);
      return;
    }
    setSettled(false);
    const enter = window.setTimeout(() => setEntered(true), 40);
    const timer = window.setTimeout(() => setSettled(true), COLLAPSE_DELAY_MS);
    return () => {
      window.clearTimeout(enter);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="relative rounded-lg border border-ink/8 bg-white p-6 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)] dark:border-white/8 dark:bg-dark-card">
      <p className="mb-2 text-[11px] font-extrabold tracking-wide text-muted-2 uppercase">
        Settle up — the signature moment
      </p>
      {/* Desktop: the animated collapse graph. */}
      <div className="relative hidden aspect-[420/300] sm:block">
        <svg viewBox="0 0 420 300" className="absolute inset-0 h-full w-full overflow-visible">
          <defs>
            <marker id="heroArrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
              <path
                d="M0,0 L8,4 L0,8 Z"
                className="fill-ink dark:fill-dark-text"
                fillOpacity="0.4"
              />
            </marker>
          </defs>

          {RAW_DEBTS.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              className="stroke-coral transition-opacity duration-500"
              strokeOpacity={settled ? 0 : 0.28}
              strokeWidth="1"
            />
          ))}

          {TRANSFERS.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              className="stroke-ink transition-opacity duration-700 dark:stroke-dark-text"
              strokeOpacity={settled ? 0.16 : 0}
              strokeWidth="2.5"
              markerEnd={settled ? "url(#heroArrow)" : undefined}
            />
          ))}
        </svg>

        {PAYERS.map((person) => (
          <div
            key={person.initials}
            className="absolute left-[8%] flex aspect-square w-[9%] min-w-9 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white"
            style={{ top: person.top, backgroundColor: person.color }}
          >
            {person.initials}
          </div>
        ))}

        {RECEIVERS.map((person) => (
          <div
            key={person.initials}
            className="absolute right-[6%] flex aspect-square w-[13%] min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-[15px] font-bold text-white ring-4 ring-mint-tint transition-all duration-500 dark:ring-mint/18"
            style={{
              top: person.top,
              backgroundColor: person.color,
              // The ring is the "you're owed" marker; it belongs to the
              // settled reading, so it arrives with the transfers.
              boxShadow: settled ? undefined : "none",
              opacity: settled ? 1 : 0.55,
            }}
          >
            {person.initials}
          </div>
        ))}

        {PAYERS.map((person, i) => (
          <div
            key={`${person.initials}-amount`}
            className="num absolute left-[41%] -translate-y-1/2 rounded-full border border-ink/10 bg-white px-2.5 py-1 text-xs text-ink shadow-[0_6px_14px_-6px_rgba(19,46,40,0.3)] transition-all duration-500 dark:border-white/12 dark:bg-dark-bg dark:text-dark-text"
            style={{
              top: person.top,
              opacity: settled ? 1 : 0,
              transform: `translateY(-50%) scale(${settled ? 1 : 0.85})`,
              transitionDelay: settled ? `${120 + i * 70}ms` : "0ms",
            }}
          >
            {person.amount}
          </div>
        ))}
      </div>

      {/* Mobile: the settled transfers as a readable list, not a cramped
          graph — the rows cascade in as the "signature moment". */}
      <div className="flex flex-col gap-1.5 sm:hidden">
        {SETTLED_TRANSFERS.map((t, i) => (
          <div
            key={`${t.from.initials}-${t.to.initials}`}
            className="flex items-center justify-between rounded-[11px] bg-cream px-3 py-2 dark:bg-dark-bg"
            style={{
              opacity: entered ? 1 : 0,
              transform: `translateY(${entered ? 0 : 6}px)`,
              transition: "opacity .5s ease, transform .5s ease",
              transitionDelay: `${i * 70}ms`,
            }}
          >
            <div className="flex items-center gap-1.5">
              <Avatar initials={t.from.initials} color={t.from.color} />
              <span className="text-muted-2" aria-hidden="true">
                →
              </span>
              <Avatar initials={t.to.initials} color={t.to.color} />
            </div>
            <span className="num text-[13px] font-bold text-ink dark:text-dark-text">
              {t.amount}
            </span>
          </div>
        ))}
      </div>

      <div
        className={`mt-1.5 flex items-center gap-1.5 rounded-[11px] px-3.5 py-2.5 transition-colors duration-500 ${
          settled
            ? "bg-mint-tint dark:bg-mint/16"
            : "bg-coral-tint dark:bg-coral/14"
        }`}
      >
        {settled ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald dark:text-mint" aria-hidden="true" />
            <span className="text-[12.5px] font-bold text-emerald dark:text-mint">
              5 transfers settle everyone
            </span>
          </>
        ) : (
          <span className="text-[12.5px] font-bold text-coral">
            12 IOUs between 8 people
          </span>
        )}
      </div>
    </div>
  );
}
