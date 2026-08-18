// Persisted UI preferences for the desktop group workspace.
//
// The VIEW preference (workspace vs classic) is a COOKIE, not localStorage,
// specifically so the server can read it: the /enter endpoint routes a group
// switch straight to /workspace or /events, avoiding the /events -> /workspace
// URL blink a client-side redirect would cause. One-page is the DEFAULT on
// desktop -- an unset preference means workspace. A companion `fst_vw` cookie
// (set pre-paint in the root layout) tells the server the viewport.
//
// The COLLAPSE preference is also a cookie, read during SSR of the workspace
// page (via next/headers cookies()).

export const GROUP_VIEW_COOKIE = "fst_group_view";
export const VIEWPORT_COOKIE = "fst_vw";
export const GROUP_COLLAPSED_COOKIE = "fst_group_collapsed";

export type GroupView = "workspace" | "classic";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function setGroupView(view: GroupView): void {
  if (typeof document === "undefined") return;
  document.cookie = `${GROUP_VIEW_COOKIE}=${view}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
}

/** Comma-separated event ids -> Set. Tolerant of undefined/empty. */
export function parseCollapsed(raw: string | undefined): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Set -> comma-separated string (insertion order is stable). */
export function serializeCollapsed(ids: Set<string>): string {
  return [...ids].join(",");
}

export function setCollapsedCookie(ids: Set<string>): void {
  if (typeof document === "undefined") return;
  document.cookie = `${GROUP_COLLAPSED_COOKIE}=${serializeCollapsed(ids)}; path=/; max-age=${ONE_YEAR}; SameSite=Lax`;
}
