/** Hard ceiling on what we will even attempt to decode. */
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
/** Longest edge after downscaling. A receipt only has to be legible. */
export const RECEIPT_MAX_EDGE = 1600;
export const RECEIPT_QUALITY = 0.8;

export class ReceiptTooLargeError extends Error {}
export class ReceiptDecodeError extends Error {}

/**
 * Scales (width, height) so the longest edge is at most `max`, preserving
 * aspect ratio. Images already within the bound are returned unchanged.
 */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Downscales and re-encodes a picked image to JPEG in the browser.
 *
 * Always returns image/jpeg, whatever went in, which collapses the server's
 * MIME allowlist to one value. A ~4 MB phone photo lands around 300 KB --
 * that factor of ~13 is the single largest lever on every Blob quota.
 *
 * Throws rather than falling back to the original bytes. There is
 * deliberately no path in this app that uploads an uncompressed file: an
 * image nobody can decode is worse stored than rejected.
 */
export async function compressReceipt(file: File): Promise<File> {
  if (file.size > MAX_RECEIPT_BYTES) {
    throw new ReceiptTooLargeError(`${(file.size / 1024 / 1024).toFixed(1)} MB`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Reached when the browser has no decoder -- e.g. a HEIC on a
    // non-Apple browser. iOS transcodes to JPEG at pick time because of the
    // input's accept list, so this should be rare.
    throw new ReceiptDecodeError("decode failed");
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height, RECEIPT_MAX_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new ReceiptDecodeError("no 2d context");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", RECEIPT_QUALITY),
  );
  if (!blob) throw new ReceiptDecodeError("encode failed");

  return new File([blob], "receipt.jpg", { type: "image/jpeg" });
}
