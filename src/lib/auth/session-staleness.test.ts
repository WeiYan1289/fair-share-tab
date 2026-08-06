import { describe, expect, it } from "vitest";
import { isSessionStale } from "./session-staleness";

const ISSUED_AT = new Date("2026-08-05T10:00:00.000Z").getTime();

describe("isSessionStale", () => {
  it("is not stale when the password has never been changed", () => {
    expect(isSessionStale({ issuedAt: ISSUED_AT, passwordChangedAt: null })).toBe(false);
  });

  it("is not stale when the password changed before the session was issued", () => {
    const passwordChangedAt = new Date(ISSUED_AT - 1000);

    expect(isSessionStale({ issuedAt: ISSUED_AT, passwordChangedAt })).toBe(false);
  });

  it("is stale when the password changed after the session was issued", () => {
    const passwordChangedAt = new Date(ISSUED_AT + 1000);

    expect(isSessionStale({ issuedAt: ISSUED_AT, passwordChangedAt })).toBe(true);
  });

  // Same-millisecond ordering is unknowable, so this resolves toward
  // rejecting the session: the cost is one extra login, the cost of the
  // opposite default is an attacker's session surviving the reset meant to
  // evict it.
  it("is stale when the password changed in the same millisecond the session was issued", () => {
    const passwordChangedAt = new Date(ISSUED_AT);

    expect(isSessionStale({ issuedAt: ISSUED_AT, passwordChangedAt })).toBe(true);
  });
});
