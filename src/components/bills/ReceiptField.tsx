"use client";

import { useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { ReceiptPreviewModal } from "@/components/bills/ReceiptPreviewModal";
import type { ReceiptUpload } from "@/lib/receipts/use-receipt-upload";

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Screen Spec P5-01. Purely presentational -- all state lives in
 * useReceiptUpload so BillForm can await and retry it.
 *
 * No "(optional)" tag and no asterisk: the dashed outline says "you may"
 * without a label saying so, and nothing here ever disables Save.
 *
 * accept lists JPEG/PNG/WebP and excludes HEIC on purpose -- iOS transcodes
 * a HEIC photo to JPEG during selection when the accept list names JPEG, so
 * the format never reaches us from the platform that produces it.
 */
export function ReceiptField({ receipt }: { receipt: ReceiptUpload }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewing, setPreviewing] = useState(false);
  const { state } = receipt;

  // An attached receipt is something to look at, not a replace target.
  // Replacing goes through Remove -> pick again, which is what the file
  // input does everywhere else.
  const previewUrl = state.previewUrl ?? state.url;
  const canPreview = state.status === "attached" && previewUrl !== null;

  return (
    <div className="mb-4.5">
      <label className="mb-1.5 block text-xs font-bold text-muted-2">
        Receipt <span className="font-normal text-muted-2/70">(optional)</span>
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) receipt.select(file);
          // Reset so picking the same file twice still fires onChange.
          e.target.value = "";
        }}
      />

      {state.status === "empty" ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-2.5 rounded-md border border-dashed border-ink/24 bg-white px-4 py-3.5 text-[14px] text-muted hover:border-forest dark:border-white/24 dark:bg-dark-card dark:text-dark-muted"
        >
          <ImagePlus className="h-4 w-4" aria-hidden="true" />
          Add a photo
        </button>
      ) : (
        <div className="flex items-start gap-3 rounded-md border border-ink/8 bg-white p-3 dark:border-white/8 dark:bg-dark-card">
          {state.previewUrl &&
            (canPreview ? (
              <button
                type="button"
                onClick={() => setPreviewing(true)}
                className="shrink-0"
                title="View receipt"
                aria-label="View receipt"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={state.previewUrl}
                  alt=""
                  className="h-[54px] w-[54px] rounded object-cover"
                />
              </button>
            ) : (
              // Still uploading, or failed: nothing to open yet, so the
              // thumbnail is inert rather than misleadingly clickable.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={state.previewUrl}
                alt=""
                className="h-[54px] w-[54px] shrink-0 rounded object-cover"
              />
            ))}
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              {/* A receipt loaded from the database has no filename -- we
                  never stored one -- so omit the line rather than render a
                  blank one above the status. */}
              {state.fileName ? (
                <p className="truncate text-[13.5px] font-bold text-ink dark:text-dark-text">
                  {state.fileName}
                </p>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={receipt.clear}
                aria-label="Remove receipt"
                className="shrink-0 text-muted-2"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {state.status === "working" && (
              <>
                <p className="mt-0.5 text-[12px] text-muted-2 dark:text-dark-muted">
                  {state.fileSize !== null && `${formatSize(state.fileSize)} · `}uploading…
                </p>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-cream dark:bg-dark-bg">
                  <div
                    className="h-full rounded-full bg-forest transition-[width] dark:bg-dark-forest"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
              </>
            )}

            {state.status === "attached" && (
              <p className="mt-0.5 text-[12px] text-emerald dark:text-mint">
                {state.fileSize !== null && `${formatSize(state.fileSize)} · `}attached ✓
              </p>
            )}

            {state.status === "error" && (
              <p className="mt-0.5 text-[12px] text-muted dark:text-dark-muted">
                {state.error}{" "}
                {/* Retry only where retrying could succeed. A file rejected
                    for size or an unreadable format will fail identically
                    the second time, so it gets no button. */}
                {state.canRetry && (
                  <>
                    <button
                      type="button"
                      onClick={receipt.retry}
                      className="font-bold text-forest underline dark:text-mint"
                    >
                      Retry
                    </button>{" "}
                    —{" "}
                  </>
                )}
                {state.canRetry ? "or save the bill without it." : "You can still save the bill."}
              </p>
            )}
          </div>
        </div>
      )}

      {previewing && previewUrl && (
        <ReceiptPreviewModal url={previewUrl} onClose={() => setPreviewing(false)} />
      )}
    </div>
  );
}
