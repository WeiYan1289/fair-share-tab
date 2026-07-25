"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CreateGroupModal } from "@/components/group/CreateGroupModal";
import { Check } from "lucide-react";

// Five payers settling up with three receivers in just five transfers —
// deliberately more people than the old 3-payer mock, to show the
// settlement engine collapsing a genuinely tangled bill history down to a
// handful of transfers. Amounts are hand-picked so a greedy max-debtor/
// max-creditor match (the real algorithm, see docs/system-design.md §4.4)
// produces exactly this set: AR->PS 500, KM->JI 250, HZ->SM 100,
// DV->JI 100, NF->SM 50 — each side sums to 1000.
const PAYERS = [
  { initials: "AR", color: "#B5654A", top: "8%", amount: "RM 500" },
  { initials: "KM", color: "#7A5C9E", top: "26%", amount: "RM 250" },
  { initials: "HZ", color: "#3E7C86", top: "44%", amount: "RM 100" },
  { initials: "DV", color: "#B98A2E", top: "62%", amount: "RM 100" },
  { initials: "NF", color: "#6B7280", top: "80%", amount: "RM 50" },
];

const RECEIVERS = [
  { initials: "PS", color: "#2F7FB8", top: "15%" },
  { initials: "JI", color: "#1F9E68", top: "50%" },
  { initials: "SM", color: "#B54A6A", top: "85%" },
];

// Screen Spec P1-01. The only landing view — shown to every visitor
// regardless of device history, since access is granted purely by opening a
// group's link. Kept to a single, uncluttered hero moment -- the
// step-by-step explainer and the no-password disclosure live on /tutorial
// instead, one quiet link away.
export function Landing() {
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      <div className="mx-auto max-w-[1160px] px-6 py-10 sm:px-10 sm:py-12">
        <div className="mb-12 flex items-center justify-between sm:mb-16">
          <Logo size={26} wordmarkClassName="text-lg" />
          <ThemeToggle />
        </div>

        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
          <div className="lg:max-w-[440px] lg:flex-1">
            <h1 className="num mb-4 text-[34px] leading-[1.15] text-ink sm:text-[42px] dark:text-dark-text">
              Split trip costs fairly. Settle up in one step.
            </h1>
            <p className="mb-7 text-[15px] leading-relaxed text-muted dark:text-dark-muted">
              Log bills as you go — FairShareTab works out who owes who, then shows the
              fewest transfers to close it out.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-3.5">
              <Button variant="primary" onClick={() => setShowCreateGroup(true)}>
                Create a group
              </Button>
              <p className="max-w-[150px] text-xs leading-snug text-muted dark:text-dark-muted">
                No account or sign-up — just a name.
              </p>
            </div>
            <Link
              href="/tutorial"
              className="mt-3 block w-fit text-[12.5px] text-muted-2 underline decoration-dotted underline-offset-4 hover:text-muted dark:hover:text-dark-muted"
            >
              See how it works →
            </Link>
          </div>

          <div className="lg:flex-1">
            <div className="relative rounded-lg border border-ink/8 bg-white p-6 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)] dark:border-white/8 dark:bg-dark-card">
              <p className="mb-2 text-[11px] font-extrabold tracking-wide text-muted-2 uppercase">
                Settle up — the signature moment
              </p>
              <div className="relative aspect-[420/300]">
                <svg
                  viewBox="0 0 420 300"
                  className="absolute inset-0 h-full w-full overflow-visible"
                >
                  <defs>
                    <marker
                      id="heroArrow"
                      markerWidth="8"
                      markerHeight="8"
                      refX="6"
                      refY="4"
                      orient="auto"
                    >
                      <path
                        d="M0,0 L8,4 L0,8 Z"
                        className="fill-ink dark:fill-dark-text"
                        fillOpacity="0.4"
                      />
                    </marker>
                  </defs>
                  {/* AR -> PS */}
                  <path
                    d="M80,24 Q212,10 345,45"
                    fill="none"
                    className="stroke-ink dark:stroke-dark-text"
                    strokeOpacity="0.16"
                    strokeWidth="2.5"
                    markerEnd="url(#heroArrow)"
                  />
                  {/* KM -> JI */}
                  <path
                    d="M80,78 Q212,70 345,150"
                    fill="none"
                    className="stroke-ink dark:stroke-dark-text"
                    strokeOpacity="0.16"
                    strokeWidth="2.5"
                    markerEnd="url(#heroArrow)"
                  />
                  {/* HZ -> SM */}
                  <path
                    d="M80,132 Q212,150 345,255"
                    fill="none"
                    className="stroke-ink dark:stroke-dark-text"
                    strokeOpacity="0.16"
                    strokeWidth="2.5"
                    markerEnd="url(#heroArrow)"
                  />
                  {/* DV -> JI */}
                  <path
                    d="M80,186 Q212,200 345,150"
                    fill="none"
                    className="stroke-ink dark:stroke-dark-text"
                    strokeOpacity="0.16"
                    strokeWidth="2.5"
                    markerEnd="url(#heroArrow)"
                  />
                  {/* NF -> SM */}
                  <path
                    d="M80,240 Q212,260 345,255"
                    fill="none"
                    className="stroke-ink dark:stroke-dark-text"
                    strokeOpacity="0.16"
                    strokeWidth="2.5"
                    markerEnd="url(#heroArrow)"
                  />
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
                    className="absolute right-[6%] flex aspect-square w-[13%] min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-[15px] font-bold text-white ring-4 ring-mint-tint dark:ring-mint/18"
                    style={{ top: person.top, backgroundColor: person.color }}
                  >
                    {person.initials}
                  </div>
                ))}

                {PAYERS.map((person) => (
                  <div
                    key={`${person.initials}-amount`}
                    className="num absolute left-[41%] -translate-y-1/2 rounded-full border border-ink/10 bg-white px-2.5 py-1 text-xs text-ink shadow-[0_6px_14px_-6px_rgba(19,46,40,0.3)] dark:border-white/12 dark:bg-dark-bg dark:text-dark-text"
                    style={{ top: person.top }}
                  >
                    {person.amount}
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 rounded-[11px] bg-mint-tint px-3.5 py-2.5 dark:bg-mint/16">
                <Check className="h-3.5 w-3.5 text-emerald dark:text-mint" aria-hidden="true" />
                <span className="text-[12.5px] font-bold text-emerald dark:text-mint">
                  5 transfers settle everyone
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}
