import { describe, it, expect } from "vitest";
import { computeCurrencyOverviews, type CombinedEventInput } from "./combined";

function evt(eventId: string, currency: string, bills: CombinedEventInput["bills"]): CombinedEventInput {
  return { eventId, currency, bills };
}
function bill(payerId: string, totalAmount: number, shares: [string, number][]) {
  return { payerId, totalAmount, splits: shares.map(([memberId, shareAmount]) => ({ memberId, shareAmount })) };
}

describe("computeCurrencyOverviews", () => {
  it("includes a single-event currency (no >=2 gate)", () => {
    const res = computeCurrencyOverviews([
      evt("e1", "USD", [bill("a", 100, [["a", 50], ["b", 50]])]),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].currency).toBe("USD");
    expect(res[0].eventCount).toBe(1);
    expect(res[0].eventIds).toEqual(["e1"]);
    expect(res[0].transfers).toEqual([{ fromMemberId: "b", toMemberId: "a", amount: 50 }]);
  });

  it("partitions by currency and never nets across them", () => {
    const res = computeCurrencyOverviews([
      evt("e1", "MYR", [bill("a", 100, [["a", 50], ["b", 50]])]),
      evt("e2", "USD", [bill("c", 200, [["c", 100], ["d", 100]])]),
    ]);
    expect(res.map((r) => r.currency).sort()).toEqual(["MYR", "USD"]);
    expect(res.find((r) => r.currency === "MYR")!.unsettledTotal).toBe(100);
    expect(res.find((r) => r.currency === "USD")!.unsettledTotal).toBe(200);
  });

  it("nets several events of one currency together", () => {
    const res = computeCurrencyOverviews([
      evt("e1", "MYR", [bill("a", 100, [["a", 50], ["b", 50]])]),
      evt("e2", "MYR", [bill("b", 100, [["a", 50], ["b", 50]])]),
    ]);
    expect(res).toHaveLength(1);
    expect(res[0].eventCount).toBe(2);
    // a paid 100 owed 100; b paid 100 owed 100 -> everyone square, no transfers.
    expect(res[0].transfers).toEqual([]);
  });

  it("skips events with no unsettled bills", () => {
    expect(computeCurrencyOverviews([evt("e1", "MYR", [])])).toEqual([]);
  });
});
