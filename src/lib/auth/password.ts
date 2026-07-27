import * as argon2 from "argon2";

// OWASP Password Storage Cheat Sheet current baseline for Argon2id.
const HASH_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

// Hashing is CPU/memory-bound by design (that's the point of Argon2id) — an
// unbounded input length would let a request pay that cost against an
// attacker-chosen multi-megabyte string. No real password is this long.
const MAX_PASSWORD_LENGTH = 256;

export async function hashPassword(plain: string): Promise<string> {
  if (plain.length > MAX_PASSWORD_LENGTH) {
    throw new Error(`Password exceeds maximum length of ${MAX_PASSWORD_LENGTH} characters`);
  }
  return argon2.hash(plain, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (plain.length > MAX_PASSWORD_LENGTH) return false;
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // Malformed/foreign hash (e.g. the dummy-hash timing-safety path in
    // login) — treat as a non-match rather than throwing.
    return false;
  }
}

let dummyHash: Promise<string> | null = null;

/**
 * A real Argon2id hash of an unknown, never-used password. login() verifies
 * an incoming password against this when the email doesn't exist, so a
 * nonexistent-email response takes the same amount of time as a
 * wrong-password response (no user-enumeration timing side channel).
 */
export function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = hashPassword("fst-dummy-hash-for-timing-safety-only");
  return dummyHash;
}
