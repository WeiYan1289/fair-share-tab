// Every Vercel Blob public store is served from
// <storeId>.public.blob.vercel-storage.com. The leading dot matters: it
// forces the match onto a whole label, so "notpublic.blob.vercel-..." and
// "public.blob.vercel-storage.com.evil.com" are both rejected.
const RECEIPT_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * True only for URLs we are willing to render as a receipt.
 *
 * This is an access-control check, not a formatting one. A bill is visible
 * to everyone holding the group link, so an unvalidated receipt URL would
 * be a phishing surface and a tracking pixel in one.
 *
 * Deliberately a suffix check rather than one pinned host: it keeps a
 * separate development Blob store working with no extra env var.
 */
export function isReceiptUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "https:" && url.hostname.endsWith(RECEIPT_HOST_SUFFIX);
}
