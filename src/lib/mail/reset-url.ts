/**
 * Builds the password-reset link that goes into an email.
 *
 * The origin comes from APP_URL and nothing else. It must never be derived
 * from the incoming request's Host header: that header is attacker-
 * controlled, and a forged one would make our own server email a victim a
 * reset link pointing at the attacker's domain — the classic password-reset
 * takeover. An unset APP_URL therefore throws rather than falling back to
 * anything request-derived; failing loudly beats failing exploitably.
 */
export function buildResetUrl(token: string): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is not set — refusing to build a reset link from request-derived data");
  }

  const origin = appUrl.replace(/\/+$/, "");
  return `${origin}/reset?token=${encodeURIComponent(token)}`;
}
