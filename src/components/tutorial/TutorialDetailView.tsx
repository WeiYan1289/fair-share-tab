"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { CreateGroupModal } from "@/components/group/CreateGroupModal";
import { ScreenshotFrame, type TutorialScreenshot } from "@/components/tutorial/ScreenshotFrame";
import { cn } from "@/lib/cn";

export interface TutorialDetailStep {
  title: string;
  body: string;
  screenshot: TutorialScreenshot;
}

interface TutorialDetailViewProps {
  eyebrow: string;
  title: string;
  intro: string;
  steps: TutorialDetailStep[];
}

// A swipe has to be clearly horizontal, or every vertical scroll that drifts
// sideways would page the step out from under the reader.
const SWIPE_MIN_X = 56;
const SWIPE_MAX_Y = 44;

// One detail walkthrough, linked from the /tutorial overview's "See the
// full walkthrough" links. Standalone marketing/help page, same as
// TutorialView -- not part of the Screen Spec.
export function TutorialDetailView({ eyebrow, title, intro, steps }: TutorialDetailViewProps) {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Reached from the in-app "?" button rather than the marketing site, so
  // the account CTAs would be dead ends -- the reader already has a group
  // open behind this page. Mirrors TutorialView's own embedded handling.
  const embedded = searchParams.get("embedded") === "1";
  // Set by the overview's walkthrough links. router.back() is what actually
  // restores the reader's place in that long page: the App Router keeps a
  // scroll position per history entry, and only a real pop navigation
  // replays it. A pushed <Link href="/tutorial"> always lands at the top.
  const cameFromOverview = searchParams.get("from") === "tutorial";
  const overviewHref = embedded ? "/tutorial?embedded=1" : "/tutorial";

  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const goToStep = (index: number, moveFocus = false) => {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    setActiveStep(next);
    if (moveFocus) tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToStep(activeStep + 1, true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToStep(activeStep - 1, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      goToStep(0, true);
    } else if (event.key === "End") {
      event.preventDefault();
      goToStep(steps.length - 1, true);
    }
  };

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

        <div className="mb-8 sm:mb-14">
          {cameFromOverview ? (
            <button
              type="button"
              onClick={() => router.back()}
              className="text-[13px] font-bold text-link hover:text-forest dark:text-mint dark:hover:opacity-80"
            >
              ← Back to tutorial
            </button>
          ) : (
            <Link
              href={overviewHref}
              className="text-[13px] font-bold text-link hover:text-forest dark:text-mint dark:hover:opacity-80"
            >
              ← Back to tutorial
            </Link>
          )}
        </div>

        <p className="mb-2.5 text-[12px] font-bold tracking-wide text-muted-2 uppercase">
          {eyebrow}
        </p>
        <h1 className="num mb-3 text-[24px] leading-[1.25] text-ink sm:mb-4 sm:text-[36px] sm:leading-[1.2] dark:text-dark-text">
          {title}
        </h1>
        <p className="mb-8 max-w-[520px] text-[14px] leading-relaxed text-muted sm:mb-14 sm:text-[15px] dark:text-dark-muted">
          {intro}
        </p>

        {/* Mobile: one step at a time -- paging through 3-4 full-width
            screenshots by scroll alone made the page feel endless on a
            phone. Numbered tabs let you jump to any step directly; swipe,
            arrow keys, and Prev/Next all cover the sequential read. Desktop
            keeps the full scroll list below -- that reads fine at its wider
            column. */}
        <div className="mb-10 sm:hidden">
          <div
            className="mb-6 flex gap-1.5 rounded-md bg-app-bg p-1 dark:bg-dark-card"
            role="tablist"
            aria-label={`${title} steps`}
            onKeyDown={onTabKeyDown}
          >
            {steps.map((step, i) => (
              <button
                key={step.title}
                ref={(node) => {
                  tabRefs.current[i] = node;
                }}
                type="button"
                role="tab"
                aria-selected={activeStep === i}
                aria-label={`Step ${i + 1}: ${step.title}`}
                // Roving tabindex: one stop for the whole set, arrows move
                // within it -- the standard tabs pattern.
                tabIndex={activeStep === i ? 0 : -1}
                onClick={() => goToStep(i)}
                className={cn(
                  "flex-1 rounded-[8px] py-2 text-[13px] font-bold transition-colors",
                  activeStep === i
                    ? "bg-forest text-cream dark:bg-dark-forest"
                    : "text-muted dark:text-dark-muted",
                )}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <div
            onTouchStart={(event) => {
              const touch = event.changedTouches[0];
              touchStart.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              const start = touchStart.current;
              if (!start) return;
              touchStart.current = null;
              const touch = event.changedTouches[0];
              const dx = touch.clientX - start.x;
              const dy = touch.clientY - start.y;
              if (Math.abs(dx) < SWIPE_MIN_X || Math.abs(dy) > SWIPE_MAX_Y) return;
              goToStep(activeStep + (dx < 0 ? 1 : -1));
            }}
          >
            <StepContent step={steps[activeStep]} index={activeStep} />
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              type="button"
              disabled={activeStep === 0}
              aria-label="Previous step"
              onClick={() => goToStep(activeStep - 1)}
              className="text-[13px] font-bold text-link disabled:pointer-events-none disabled:opacity-30 dark:text-mint"
            >
              ← Back
            </button>
            <p className="text-[11.5px] font-bold text-muted-2">
              Step {activeStep + 1} of {steps.length}
            </p>
            <button
              type="button"
              disabled={activeStep === steps.length - 1}
              aria-label="Next step"
              onClick={() => goToStep(activeStep + 1)}
              className="text-[13px] font-bold text-link disabled:pointer-events-none disabled:opacity-30 dark:text-mint"
            >
              Next →
            </button>
          </div>
        </div>

        <div className="mb-10 hidden flex-col gap-16 sm:mb-16 sm:flex">
          {steps.map((step, i) => (
            <StepContent key={step.title} step={step} index={i} />
          ))}
        </div>

        {embedded ? (
          <div className="mt-10 border-t border-ink/8 pt-8 sm:mt-16 sm:pt-12 dark:border-white/10">
            <button
              type="button"
              onClick={() => router.back()}
              className="text-[13px] font-bold text-link hover:text-forest dark:text-mint dark:hover:opacity-80"
            >
              ← Back to tutorial
            </button>
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-start gap-4 border-t border-ink/8 pt-8 sm:mt-16 sm:flex-row sm:items-center sm:justify-between sm:pt-12 dark:border-white/10">
            <div>
              <p className="mb-1 text-[17px] font-bold text-ink dark:text-dark-text">
                Ready to try it yourself?
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

function StepContent({ step, index }: { step: TutorialDetailStep; index: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-3 sm:mb-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-mint-tint text-[13px] font-extrabold text-emerald dark:bg-mint/16 dark:text-mint">
          {index + 1}
        </div>
        <p className="text-[16px] font-bold text-ink sm:text-[17px] dark:text-dark-text">
          {step.title}
        </p>
      </div>
      <p className="mb-4 max-w-[560px] text-[13px] leading-relaxed text-muted sm:text-[14px] dark:text-dark-muted">
        {step.body}
      </p>
      <ScreenshotFrame screenshot={step.screenshot} />
    </div>
  );
}
