"use client";

/**
 * Shares one in-flight GET between every caller asking for the same URL at
 * the same time.
 *
 * GroupHeader deliberately renders two full layouts (mobile and sm+, one
 * CSS-hidden) rather than one flexed to fit both, so each self-fetching
 * child inside it mounts twice and fires the same request twice --
 * /api/auth/me twice per page is four DB queries for one header. React
 * Strict Mode doubles that again in dev, which is why the Network panel
 * shows four.
 *
 * Only the in-flight promise is shared; the entry is dropped as soon as it
 * settles. That is the point -- this is request coalescing, not a cache. A
 * later mount (a client-side navigation, a re-render after logout or an
 * ownership change) refetches exactly as it does today, so no screen can
 * show data that is staler than it was before. Freshness is unchanged; only
 * the duplicate concurrent round-trips go away.
 *
 * Resolves to null on a non-OK response or a network error, matching what
 * the existing callers already do with both.
 */
const inFlight = new Map<string, Promise<unknown>>();

export function dedupedFetchJson<T>(url: string): Promise<T | null> {
  const existing = inFlight.get(url);
  if (existing) return existing as Promise<T | null>;

  const request = fetch(url)
    .then((res) => (res.ok ? (res.json() as Promise<T>) : null))
    .catch(() => null)
    .finally(() => {
      inFlight.delete(url);
    });

  inFlight.set(url, request);
  return request;
}
