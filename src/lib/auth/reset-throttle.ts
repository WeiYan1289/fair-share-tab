/**
 * Per-account rate limiting for password reset requests.
 *
 * This is the load-bearing abuse control, not the per-IP limiter in
 * rate-limit.ts -- that one is in-memory and only holds within a single
 * warm serverless instance, so it is a cheap first line and nothing more.
 * These limits are evaluated against rows in password_reset_token, so they
 * work across instances, survive cold starts, and need no Redis.
 *
 * They exist to stop two things: bombing a victim's inbox by replaying
 * their address, and draining the provider's daily send quota so nobody
 * else can reset. A throttled request must still return the same generic
 * 200 as a sent one -- if throttling looked different, the throttle would
 * itself become a user-enumeration oracle.
 */

/** No second email inside this window, however many times the form is submitted. */
export const RESET_COOLDOWN_MS = 60_000;

/** Ceiling on reset emails per account per RESET_DAILY_WINDOW_MS. */
export const RESET_DAILY_CAP = 5;

export const RESET_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isResetRequestThrottled(input: {
  now: Date;
  /** created_at of this user's reset tokens; order does not matter. */
  tokenCreatedAts: Date[];
}): boolean {
  const now = input.now.getTime();

  const withinCooldown = input.tokenCreatedAts.some(
    (createdAt) => now - createdAt.getTime() < RESET_COOLDOWN_MS,
  );
  if (withinCooldown) return true;

  const withinDailyWindow = input.tokenCreatedAts.filter(
    (createdAt) => now - createdAt.getTime() < RESET_DAILY_WINDOW_MS,
  );
  return withinDailyWindow.length >= RESET_DAILY_CAP;
}
