"use client";

import { useCallback, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  compressReceipt,
  ReceiptDecodeError,
  ReceiptTooLargeError,
} from "@/lib/receipts/compress";

export type ReceiptStatus = "empty" | "working" | "attached" | "error";

export interface ReceiptState {
  status: ReceiptStatus;
  url: string | null;
  previewUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  progress: number;
  error: string | null;
  /**
   * Whether `retry()` would do anything. False for a file that was
   * rejected before it was ever uploaded -- too large, or undecodable --
   * since re-sending the same bytes cannot change the outcome. Offering a
   * dead Retry there is worse than offering none.
   */
  canRetry: boolean;
}

export interface ReceiptUpload {
  state: ReceiptState;
  select(file: File): void;
  clear(): void;
  retry(): void;
  /** Resolves to the final URL, or null if it failed or timed out. */
  settle(timeoutMs: number): Promise<string | null>;
}

const EMPTY: ReceiptState = {
  status: "empty",
  url: null,
  previewUrl: null,
  fileName: null,
  fileSize: null,
  progress: 0,
  error: null,
  canRetry: false,
};

/**
 * Owns select -> compress -> upload for one optional receipt.
 *
 * Lives in a hook rather than inside ReceiptField because BillForm needs to
 * await an in-flight upload on Save (settle) and re-drive it afterwards
 * (retry). The parent owning the state beats reaching into a child.
 *
 * Bytes go browser -> Blob directly; only the token request touches a
 * function.
 */
export function useReceiptUpload(groupId: string, initialUrl?: string | null): ReceiptUpload {
  const [state, setState] = useState<ReceiptState>(
    initialUrl
      ? // fileName/fileSize stay null: the original filename is not stored
        // (one column, by design). ReceiptField omits the name line rather
        // than rendering a blank one.
        { ...EMPTY, status: "attached", url: initialUrl, previewUrl: initialUrl }
      : EMPTY,
  );

  // The in-flight upload, so Save can await it without re-triggering.
  const pendingRef = useRef<Promise<string | null> | null>(null);
  // The settled URL, read by settle() without waiting on a state flush.
  const urlRef = useRef<string | null>(initialUrl ?? null);
  // The compressed file, kept so retry() does not recompress.
  const fileRef = useRef<File | null>(null);
  // The name the user picked. compressReceipt renames its output to
  // receipt.jpg, so without this a retry would relabel the row.
  const nameRef = useRef<string>("receipt.jpg");
  // Object URLs must be revoked or they leak for the page's lifetime.
  const previewRef = useRef<string | null>(null);
  // One retry only -- a loop would burn the advanced-operations allowance.
  const retriedRef = useRef(false);

  const releasePreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
  }, []);

  const startUpload = useCallback(
    (file: File, fileName: string, fileSize: number, previewUrl: string | null) => {
      setState({
        status: "working",
        url: null,
        previewUrl,
        fileName,
        fileSize,
        progress: 0,
        error: null,
        canRetry: false,
      });

      const promise = upload(`receipts/${groupId}/${crypto.randomUUID()}.jpg`, file, {
        access: "public",
        handleUploadUrl: "/api/receipts/upload-token",
        onUploadProgress: ({ percentage }) =>
          setState((s) => (s.status === "working" ? { ...s, progress: percentage } : s)),
      })
        .then((blob) => {
          urlRef.current = blob.url;
          setState((s) => ({ ...s, status: "attached", url: blob.url, progress: 100 }));
          pendingRef.current = null;
          return blob.url;
        })
        .catch(() => {
          setState((s) => ({
            ...s,
            status: "error",
            error: "Couldn't upload the receipt.",
            canRetry: !retriedRef.current,
          }));
          pendingRef.current = null;
          return null;
        });

      pendingRef.current = promise;
    },
    [groupId],
  );

  const select = useCallback(
    (file: File) => {
      retriedRef.current = false;
      urlRef.current = null;
      releasePreview();

      const preview = URL.createObjectURL(file);
      previewRef.current = preview;
      const { name, size } = file;
      nameRef.current = name;

      // Show the local preview immediately -- before a byte leaves the
      // device -- then compress, then upload.
      setState({
        status: "working",
        url: null,
        previewUrl: preview,
        fileName: name,
        fileSize: size,
        progress: 0,
        error: null,
        canRetry: false,
      });

      compressReceipt(file)
        .then((compressed) => {
          fileRef.current = compressed;
          startUpload(compressed, name, compressed.size, preview);
        })
        .catch((error: unknown) => {
          fileRef.current = null;
          const message =
            error instanceof ReceiptTooLargeError
              ? `That image is too large (${error.message}). Maximum is 10 MB.`
              : error instanceof ReceiptDecodeError
                ? "That image couldn't be read. Try a JPEG or PNG."
                : "Couldn't prepare that image.";
          // Not retryable: the same bytes will fail the same way.
          setState((s) => ({ ...s, status: "error", error: message, canRetry: false }));
        });
    },
    [releasePreview, startUpload],
  );

  const clear = useCallback(() => {
    releasePreview();
    pendingRef.current = null;
    fileRef.current = null;
    urlRef.current = null;
    retriedRef.current = false;
    setState(EMPTY);
  }, [releasePreview]);

  const retry = useCallback(() => {
    const file = fileRef.current;
    if (!file || retriedRef.current) return;
    retriedRef.current = true;
    startUpload(file, nameRef.current, file.size, previewRef.current);
  }, [startUpload]);

  /**
   * Resolves with the receipt URL if one is ready or lands within
   * timeoutMs, else null. Never rejects -- the caller saves either way.
   *
   * Reads refs rather than state so a Save fired in the same tick as an
   * upload completing still sees the URL.
   */
  const settle = useCallback(async (timeoutMs: number): Promise<string | null> => {
    if (urlRef.current) return urlRef.current;
    const pending = pendingRef.current;
    if (!pending) return null;

    return Promise.race([
      pending,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  }, []);

  return { state, select, clear, retry, settle };
}
