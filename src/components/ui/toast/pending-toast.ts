import type { ToastVariant } from "@/components/ui/toast/ToastProvider";

const KEY = "fst-pending-toast";

// Stash one toast to show after a full-page (window.location) navigation,
// which destroys the React tree and any live toast with it. All storage
// access is guarded: a missing confirmation toast must never break a
// navigation.
export function queueToast(message: string, variant: ToastVariant = "success"): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ message, variant }));
  } catch {
    // ignore — sessionStorage may be unavailable or full
  }
}

export function readAndClearPendingToast(): { message: string; variant: ToastVariant } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    sessionStorage.removeItem(KEY);
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.message === "string") {
      return { message: parsed.message, variant: parsed.variant === "error" ? "error" : "success" };
    }
    return null;
  } catch {
    return null;
  }
}
