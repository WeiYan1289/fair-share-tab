import { describe, expect, it } from "vitest";
import { formatMoney } from "./format";

describe("formatMoney", () => {
  it("formats MYR with 2 decimals and a space after the symbol", () => {
    expect(formatMoney(124000, "MYR")).toBe("RM 1,240.00");
  });

  it("defaults to MYR when no currency code is given", () => {
    expect(formatMoney(1250)).toBe("RM 12.50");
  });

  it("formats JPY with zero decimals and no space", () => {
    expect(formatMoney(1500, "JPY")).toBe("¥1,500");
  });

  it("formats KRW with zero decimals and no space", () => {
    expect(formatMoney(1500, "KRW")).toBe("₩1,500");
  });

  it("formats other 2-decimal currencies with their own symbol", () => {
    expect(formatMoney(999900, "USD")).toBe("US$ 9,999.00");
    expect(formatMoney(500, "SGD")).toBe("S$ 5.00");
  });

  // CHF, not KRW: KRW is curated now, and the point of this case is a real
  // ISO 4217 code the app deliberately does not offer.
  it("throws on an unsupported currency code", () => {
    expect(() => formatMoney(100, "CHF")).toThrow(/unsupported/i);
  });
});
