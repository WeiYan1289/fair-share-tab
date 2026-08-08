"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * Full-size receipt preview, shown in-app rather than in a new tab.
 *
 * Used from both the editable form and the read-only detail view, so
 * "click the receipt" means the same thing everywhere in the feature.
 *
 * Backdrop is heavier than the app's other modals on purpose: this is an
 * image viewer, and the surrounding UI competing with a photo of a receipt
 * makes the receipt harder to read.
 */
export function ReceiptPreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt preview"
    >
      <div className="absolute inset-0 bg-ink/75" onClick={onClose} />
      <div className="relative flex max-h-full w-full max-w-[720px] flex-col items-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          className="mb-2.5 self-end rounded-full bg-white/90 p-2 text-ink hover:bg-white dark:bg-dark-card/90 dark:text-dark-text"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="Receipt"
          className="max-h-[80vh] w-auto max-w-full rounded-md object-contain shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)]"
        />
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-[12.5px] font-bold text-white/90 underline"
        >
          Open original
        </a>
      </div>
    </div>
  );
}
