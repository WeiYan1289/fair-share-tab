/**
 * Decides whether a signed session cookie predates the account's most
 * recent password change and must therefore be rejected.
 *
 * This is what makes password reset mean anything. Without it, resetting a
 * password locks out future logins but leaves any session cookie an
 * attacker already holds working indefinitely -- which is most of what
 * "someone else has my password" is supposed to fix.
 *
 * Kept as a pure predicate with no Prisma or cookie imports so both
 * requireUserSession() and requireSession()'s member branch can share it,
 * and so the boundary conditions are unit-testable.
 */
export function isSessionStale(input: {
  /** Epoch milliseconds, from the signed session payload. */
  issuedAt: number;
  /** Null means the password has never been changed since registration. */
  passwordChangedAt: Date | null;
}): boolean {
  if (input.passwordChangedAt === null) return false;
  return input.passwordChangedAt.getTime() >= input.issuedAt;
}
