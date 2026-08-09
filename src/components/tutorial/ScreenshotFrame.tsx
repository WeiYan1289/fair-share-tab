"use client";

import { useEffect, useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";

export interface TutorialScreenshot {
  src: string;
  mobileSrc: string;
  alt: string;
}

// The screenshot's own background is the app's bg-cream -- identical to the
// tutorial pages' background in light mode, so the image had no visible edge
// (dark mode only worked by accident, light screenshot against a near-black
// page). Mounting it on a white/dark-card mat with the same elevation shadow
// EventCard already uses gives it a real boundary in both modes.
//
// Capped to 65% width on mobile -- these are full 375x812 phone screenshots,
// so at w-full they ran nearly the whole viewport tall, pushing the step
// content out of view with them. That cap is also why tapping opens a
// full-screen view: at 65% of a phone the form labels are unreadable.
export function ScreenshotFrame({ screenshot }: { screenshot: TutorialScreenshot }) {
  const [zoomed, setZoomed] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!zoomed) return;

    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setZoomed(false);
    };
    document.addEventListener("keydown", onKeyDown);

    // Restore the previous value rather than clearing it -- an open modal
    // elsewhere may already own the lock.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [zoomed]);

  return (
    <>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        aria-label={`Enlarge screenshot: ${screenshot.alt}`}
        className="group relative mx-auto block max-w-[65%] cursor-zoom-in rounded-xl bg-white p-2 shadow-[0_16px_32px_-18px_rgba(19,46,40,0.18)] transition-shadow hover:shadow-[0_22px_44px_-20px_rgba(19,46,40,0.28)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-link sm:mx-0 sm:max-w-none sm:p-3 dark:bg-dark-card dark:shadow-[0_16px_32px_-18px_rgba(0,0,0,0.55)] dark:focus-visible:outline-mint"
      >
        <picture>
          <source media="(min-width: 640px)" srcSet={screenshot.src} />
          <img
            src={screenshot.mobileSrc}
            alt={screenshot.alt}
            loading="lazy"
            className="h-auto w-full rounded-lg"
          />
        </picture>
        {/* Always visible on touch, where there is no hover to reveal it and
            where the 65% cap makes enlarging the point. */}
        <span
          aria-hidden="true"
          className="absolute right-4 bottom-4 flex h-8 w-8 items-center justify-center rounded-full bg-forest/85 text-cream opacity-100 transition-opacity sm:right-5 sm:bottom-5 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-visible:opacity-100 dark:bg-dark-forest"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </span>
      </button>

      {zoomed && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={screenshot.alt}
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-ink/85 p-4 backdrop-blur-sm sm:p-8"
        >
          <button
            ref={closeRef}
            type="button"
            aria-label="Close screenshot"
            onClick={() => setZoomed(false)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/12 text-cream transition-colors hover:bg-white/22 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cream sm:top-6 sm:right-6"
          >
            <X className="h-5 w-5" />
          </button>
          <picture>
            <source media="(min-width: 640px)" srcSet={screenshot.src} />
            <img
              src={screenshot.mobileSrc}
              alt={screenshot.alt}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[88vh] w-auto max-w-full cursor-default rounded-lg shadow-[0_32px_64px_-24px_rgba(0,0,0,0.6)]"
            />
          </picture>
        </div>
      )}
    </>
  );
}
