"use client";

import { useEffect, useRef, useState } from "react";
import { ReceiptPreviewModal } from "@/components/bills/ReceiptPreviewModal";

/**
 * Screen Spec P5-03. Renders nothing at all when the image cannot be
 * loaded -- no broken-image icon, no error text.
 *
 * That is the read half of the fail-soft rule: if Blob is unreachable or
 * the Hobby quota has locked the store for 30 days, this bill's detail view
 * renders exactly as it does for a bill that never had a receipt, and the
 * app keeps doing its whole job.
 *
 * A plain <img> on purpose: next/image would route receipts through Image
 * Optimization, a second quota with its own Hobby ceiling, for an image
 * already compressed to ~300 KB.
 */
export function ReceiptThumbnail({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // onError alone is not enough. This <img> ships in the server-rendered
  // HTML, so the browser starts loading it before React hydrates -- when
  // the request 404s in that window the error event fires with no handler
  // attached and is lost, leaving a broken-image icon on screen. That was a
  // real bug, not a hypothetical. A complete image with zero natural width
  // is one that finished loading and failed, so this catches what the
  // event missed.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) return null;

  return (
    <div className="mb-5">
      <label className="mb-2 block text-xs font-bold text-muted-2">Receipt</label>
      <button type="button" onClick={() => setPreviewing(true)} title="View receipt">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={url}
          alt="Receipt"
          onError={() => setFailed(true)}
          className="h-[120px] w-[120px] rounded-md border border-ink/8 object-cover dark:border-white/8"
        />
      </button>

      {previewing && <ReceiptPreviewModal url={url} onClose={() => setPreviewing(false)} />}
    </div>
  );
}
