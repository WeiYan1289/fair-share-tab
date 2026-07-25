import { describe, expect, it } from "vitest";
import { CURRENCIES, CURRENCY_CODES, DEFAULT_CURRENCY, getCurrencyMeta } from "./currency";

describe("currency metadata", () => {
  it("has exactly 12 curated currencies", () => {
    expect(CURRENCIES.length).toBe(12);
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

  it("has exactly one zero-decimal currency (JPY)", () => {
    const zeroDecimal = CURRENCIES.filter((c) => c.minorUnit === 0);
    expect(zeroDecimal).toEqual([expect.objectContaining({ code: "JPY" })]);
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

  it("getCurrencyMeta throws on an unsupported code", () => {
    expect(() => getCurrencyMeta("KRW")).toThrow(/unsupported/i);
  });
});
