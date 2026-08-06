import { createHash } from "crypto";
import { generateShareToken } from "./token";

// 32 base62 characters ~= 190 bits. Wider than the share-link default (22
// chars ~= 131 bits) because this token is a bearer credential for account
// takeover rather than a lookup key, and because the entropy -- not the
// hash's slowness -- is what makes the fast digest below safe.
const RESET_TOKEN_LENGTH = 32;

/**
 * Short enough that a link intercepted later is usually already dead, long
 * enough to survive slow mail delivery and a user who reads email on a
 * different device.
 */
export const RESET_TOKEN_TTL_MINUTES = 30;

export function generateResetToken(): string {
  return generateShareToken(RESET_TOKEN_LENGTH);
}

/**
 * SHA-256, not the Argon2id used for passwords. The reset flow looks a
 * token UP by its hash, which requires a deterministic, indexable digest --
 * a salted slow hash can only be verified against a row you have already
 * found. That trade is safe here only because generateResetToken produces
 * ~190 bits of entropy, leaving no guessable keyspace for a fast hash to
 * expose. Never use this for anything user-chosen.
 */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
