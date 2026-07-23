const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

const hits = new Map<string, number[]>();

/**
 * In-memory sliding-window limiter for blunting brute-force token lookups
 * (system-design.md §3.3). Only effective within a single warm server
 * instance — a multi-instance serverless deployment needs a shared store
 * (e.g. Upstash Redis) for this to hold up under real abuse.
 */
export function isRateLimited(key: string, windowMs = WINDOW_MS, max = MAX_REQUESTS): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return "unknown";
}
