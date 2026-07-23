"use client";

import { useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { PasteLinkPanel } from "./PasteLinkPanel";

const STEPS = [
  {
    label: "1",
    tint: "bg-[#E4F9EE]",
    color: "text-emerald",
    title: "Create a group",
    body: "Name it, get a link. No signup.",
  },
  {
    label: "2",
    tint: "bg-[#EAF0F7]",
    color: "text-[#4A6FA5]",
    title: "Add friends & bills",
    body: "Log expenses as they happen.",
  },
  {
    label: "3",
    tint: "bg-[#F6EFDF]",
    color: "text-[#B08A3E]",
    title: "Settle up",
    body: "Fewest transfers to even out.",
  },
];

const HERO_PEOPLE = [
  { initials: "PS", color: "#B5654A", top: "15%", amount: "RM 355" },
  { initials: "JI", color: "#7A5C9E", top: "50%", amount: "RM 160" },
  { initials: "SM", color: "#3E7C86", top: "85%", amount: "RM 95" },
];

// Screen Spec P1-01. Shown when this device has no stored group identity at
// all (Screen Spec P1-02 covers the returning-device case).
export function ColdVisitorLanding() {
  const [showPasteLink, setShowPasteLink] = useState(false);

  return (
    <div className="min-h-screen bg-cream">
      <div className="mx-auto max-w-[1160px] px-6 py-10 sm:px-10 sm:py-12">
        <Logo size={26} wordmarkClassName="text-lg" className="mb-10 sm:mb-11" />

        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-12">
          <div className="lg:max-w-[440px] lg:flex-1">
            <h1 className="num mb-3.5 text-[32px] leading-[1.15] font-bold text-ink sm:text-4xl">
              Split trip costs fairly. Settle up in one step.
            </h1>
            <p className="mb-6 text-[14.5px] leading-relaxed text-muted">
              Log bills as you go — FairShareTab works out who owes who, then shows the
              fewest transfers to close it out.
            </p>
            <div className="mb-3.5 flex flex-wrap items-center gap-3.5">
              {/* TODO: opens the create-group modal once P3-01 (Group switcher) is built */}
              <Button variant="primary">Create a group</Button>
              <p className="max-w-[150px] text-xs leading-snug text-muted">
                No account or sign-up — just a name.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPasteLink((v) => !v)}
              className="text-[13px] font-bold text-[#1F5C46] hover:text-forest"
            >
              I have an invite link →
            </button>

            {showPasteLink && <PasteLinkPanel className="mt-4" />}

            <div className="mt-9">
              <p className="mb-1 text-[11.5px] font-bold tracking-wide text-muted-2 uppercase">
                How it works
              </p>
              <div className="mt-2 grid grid-cols-3 gap-5 sm:gap-7">
                {STEPS.map((step) => (
                  <div key={step.label}>
                    <div
                      className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-[11px] text-sm font-extrabold ${step.tint} ${step.color}`}
                    >
                      {step.label}
                    </div>
                    <p className="mb-0.5 text-[13.5px] font-bold text-ink">{step.title}</p>
                    <p className="text-xs leading-snug text-muted">{step.body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-7 flex gap-2 rounded-lg bg-[#EAF0F7] p-3.5">
              <span className="text-sm">🔗</span>
              <p className="text-[11.5px] leading-relaxed text-[#3B5876]">
                Anyone with your group&apos;s link can view and edit it — there are no
                passwords yet. Only share it with people you trust.
              </p>
            </div>

            <p className="mt-8 border-t border-ink/8 pt-4 text-[11.5px] text-muted-2">
              FairShareTab — built for trips, not spreadsheets.
            </p>
          </div>

          <div className="lg:flex-1">
            <div className="relative rounded-lg border border-ink/8 bg-white p-6 shadow-[0_24px_48px_-20px_rgba(19,46,40,0.22)]">
              <p className="mb-2 text-[11px] font-extrabold tracking-wide text-muted-2 uppercase">
                Settle up — the signature moment
              </p>
              <div className="relative aspect-[420/230]">
                <svg
                  viewBox="0 0 420 230"
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
                      <path d="M0,0 L8,4 L0,8 Z" fill="#16201B" fillOpacity="0.4" />
                    </marker>
                  </defs>
                  <path
                    d="M78,44 Q210,20 350,80"
                    fill="none"
                    stroke="#16201B"
                    strokeOpacity="0.16"
                    strokeWidth="2.5"
                    markerEnd="url(#heroArrow)"
                  />
                  <path
                    d="M78,115 Q210,105 350,100"
                    fill="none"
                    stroke="#16201B"
                    strokeOpacity="0.16"
                    strokeWidth="2.5"
                    markerEnd="url(#heroArrow)"
                  />
                  <path
                    d="M78,186 Q210,164 350,120"
                    fill="none"
                    stroke="#16201B"
                    strokeOpacity="0.16"
                    strokeWidth="2.5"
                    markerEnd="url(#heroArrow)"
                  />
                </svg>

                {HERO_PEOPLE.map((person) => (
                  <div
                    key={person.initials}
                    className="absolute left-[8%] flex h-[22%] w-[12%] min-h-10 min-w-10 -translate-y-1/2 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ top: person.top, backgroundColor: person.color }}
                  >
                    {person.initials}
                  </div>
                ))}
                <div
                  className="absolute top-1/2 right-[6%] flex h-[24%] w-[13%] min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full text-[15px] font-bold text-white shadow-[0_0_0_4px_#E4F9EE]"
                  style={{ backgroundColor: "#4A6FA5" }}
                >
                  YO
                </div>

                {HERO_PEOPLE.map((person) => (
                  <div
                    key={`${person.initials}-amount`}
                    className="num absolute left-[41%] -translate-y-1/2 rounded-full border border-ink/10 bg-white px-2.5 py-1 text-xs text-ink shadow-[0_6px_14px_-6px_rgba(19,46,40,0.3)]"
                    style={{ top: person.top }}
                  >
                    {person.amount}
                  </div>
                ))}
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 rounded-[11px] bg-[#E4F9EE] px-3.5 py-2.5">
                <span className="text-[13px] text-emerald">✓</span>
                <span className="text-[12.5px] font-bold text-emerald">
                  3 transfers settle everyone
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
