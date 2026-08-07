import { describe, expect, it } from "vitest";
import { CURRENCIES, CURRENCY_CODES, DEFAULT_CURRENCY, getCurrencyMeta } from "./currency";

describe("currency metadata", () => {
  it("has exactly 13 curated currencies", () => {
    expect(CURRENCIES.length).toBe(13);
  });

  it("has unique 3-letter uppercase codes", () => {
    const codes = CURRENCIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("has a lowercase two-letter country code for every currency (used for flag icons)", () => {
    for (const c of CURRENCIES) {
      expect(c.country).toMatch(/^[a-z]{2}$/);
    }
  });

  // Guards the assumption that leaks into every money helper: most code can
  // be written as if minorUnit were always 2, and these are the entries that
  // would break it. Update deliberately, never to make a failure go away.
  it("has exactly two zero-decimal currencies (JPY, KRW)", () => {
    const zeroDecimal = CURRENCIES.filter((c) => c.minorUnit === 0).map((c) => c.code);
    expect(zeroDecimal).toEqual(["JPY", "KRW"]);
  });

  it("defaults to MYR, listed first", () => {
    expect(DEFAULT_CURRENCY).toBe("MYR");
    expect(CURRENCIES[0].code).toBe("MYR");
    expect(CURRENCY_CODES).toContain(DEFAULT_CURRENCY);
  });

  it("getCurrencyMeta returns the matching entry", () => {
    expect(getCurrencyMeta("JPY")).toEqual(
      expect.objectContaining({ code: "JPY", symbol: "¥", minorUnit: 0 }),
    );
  });

  // CHF is a real ISO 4217 code deliberately left out of the curated list --
  // the point is that "valid currency" and "offered by this app" are not the
  // same set. (This case used KRW until KRW was curated.)
  it("getCurrencyMeta throws on a real code that isn't curated", () => {
    expect(() => getCurrencyMeta("CHF")).toThrow(/unsupported/i);
  });
});
