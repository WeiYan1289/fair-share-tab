"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CreateGroupModal } from "@/components/group/CreateGroupModal";
import { SettleUpHero } from "@/components/landing/SettleUpHero";

// Screen Spec P1-01. The only landing view — shown to every visitor
// regardless of device history, since access is granted purely by opening a
// group's link. Kept to a single, uncluttered hero moment -- the
// step-by-step explainer, the role comparison, and the no-password
// disclosure all live on /tutorial instead, one quiet link away. A row of
// feature blurbs was tried here and cut: it turned the page into a second
// pitch, and "See how it works" already leads to the real explanation.
export function Landing() {
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  return (
    <div className="min-h-screen bg-cream dark:bg-dark-bg">
      <div className="mx-auto max-w-[1160px] px-6 py-10 sm:px-10 sm:py-12">
        <div className="mb-12 flex items-center justify-between sm:mb-16">
          <Logo size={26} wordmarkClassName="text-lg" />
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="flex h-9 items-center rounded-full border border-ink/14 bg-white px-4 text-[12.5px] font-bold text-ink transition-colors hover:bg-cream-hover dark:border-white/14 dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-bg"
            >
              Log in
            </Link>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
          <div className="lg:max-w-[440px] lg:flex-1">
            <h1 className="num mb-4 text-[28px] leading-[1.15] text-ink sm:text-[42px] dark:text-dark-text">
              Split trip costs fairly. Settle up in one step.
            </h1>
            <p className="mb-7 text-[14px] leading-relaxed text-muted sm:text-[15px] dark:text-dark-muted">
              Log bills as you go — FairShareTab works out who owes who, then shows the
              fewest transfers to close it out.
            </p>
            <div className="mb-4 flex flex-wrap items-center gap-3.5">
              <Button variant="primary" onClick={() => setShowCreateGroup(true)}>
                Create a group
              </Button>
              <p className="max-w-[170px] text-xs leading-snug text-muted dark:text-dark-muted">
                No account or sign-up — just a name, or{" "}
                <Link href="/register" className="underline decoration-dotted underline-offset-2 hover:text-ink dark:hover:text-dark-text">
                  create a free account
                </Link>
                .
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
            <SettleUpHero />
          </div>
        </div>
      </div>

      {showCreateGroup && <CreateGroupModal onClose={() => setShowCreateGroup(false)} />}
    </div>
  );
}
