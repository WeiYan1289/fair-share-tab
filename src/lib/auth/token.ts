import { randomBytes } from "crypto";

const BASE62_ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

// 256 isn't a multiple of 62, so mapping raw bytes with `% 62` would bias
// low values. Reject bytes >= 248 (4 * 62) so every accepted byte maps to
// exactly one of the 62 characters with equal probability.
const MAX_UNBIASED_BYTE = Math.floor(256 / BASE62_ALPHABET.length) * BASE62_ALPHABET.length;

/**
 * A share-link token: CSPRNG, base62, >=128 bits of entropy (data-model.md
 * §3.2, system-design.md §3.3). 22 base62 characters ~= 131 bits.
 */
export function generateShareToken(length = 22): string {
  let token = "";
  while (token.length < length) {
    const bytes = randomBytes(length - token.length);
    for (const byte of bytes) {
      if (byte < MAX_UNBIASED_BYTE) {
        token += BASE62_ALPHABET[byte % BASE62_ALPHABET.length];
        if (token.length === length) break;
      }
    }
  }
  return token;
}
