import type { ToastVariant } from "@/components/ui/toast/ToastProvider";

const STATUS_LABELS: Record<number, string> = {
  400: "Invalid data",
  401: "Unauthorized",
  403: "Not allowed",
  404: "Not found",
  409: "Conflict",
  429: "Too many attempts",
  500: "Server error",
  502: "Server error",
  503: "Server unavailable",
};

// Turns an API failure into a specific toast string ("{status} · {detail}")
// instead of a canned "Couldn't …". `body` is the already-parsed JSON (or
// null) that the call site read for its inline error, so the Response is
// never read twice. A string `error` field is the server's own human message
// (e.g. "Session does not match this group"); a Zod flatten() object means a
// validation failure; otherwise a status-code label is used.
export function describeApiError(status: number, body: unknown): string {
  const raw =
    body && typeof body === "object" ? (body as { error?: unknown }).error : undefined;
  let detail: string | null = null;
  if (typeof raw === "string") detail = raw;
  else if (raw && typeof raw === "object") detail = "Some required details are missing or invalid";
  const label = STATUS_LABELS[status] ?? (status >= 500 ? "Server error" : "Error");
  return detail ? `${status} · ${detail}` : `${status} · ${label}`;
}

export const NETWORK_ERROR_MESSAGE = "Network error — check your connection";

export type { ToastVariant };
