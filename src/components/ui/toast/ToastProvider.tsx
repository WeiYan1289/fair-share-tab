"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { readAndClearPendingToast } from "@/components/ui/toast/pending-toast";

export type ToastVariant = "success" | "error";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 3500;
const MAX_STACK = 3;

// App-wide toast host. Mounted once in the root layout so a toast fired from
// any client mutation renders top-center over the app -- above the z-50
// modals so a "Saved" toast shows over an open dialog.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, message, variant }].slice(-MAX_STACK));
      const timer = setTimeout(() => remove(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [remove],
  );

  // Show a toast stashed just before a full-page navigation (create/restore
  // group), which reloaded the page and dropped the live toast.
  useEffect(() => {
    const pending = readAndClearPendingToast();
    if (pending) toast(pending.message, pending.variant);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear any outstanding dismiss timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => remove(t.id)}
            aria-label="Dismiss"
            role="status"
            className={cn(
              "pointer-events-auto flex max-w-[92vw] items-center gap-2 rounded-full px-4 py-2.5 text-[13px] font-bold text-cream shadow-[0_10px_30px_-12px_rgba(19,46,40,0.35)]",
              t.variant === "success" ? "bg-forest dark:bg-dark-forest" : "bg-coral",
            )}
          >
            {t.variant === "success" ? (
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="truncate">{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}
