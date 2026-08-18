import { describe, it, expect } from "vitest";
import { previewTransfers } from "./preview-transfers";

describe("previewTransfers", () => {
  it("returns no transfers when everyone is square", () => {
    expect(previewTransfers([{ id: "a", balance: 0 }, { id: "b", balance: 0 }])).toEqual([]);
  });

  it("routes a single debt from the negative member to the positive one", () => {
    const t = previewTransfers([{ id: "a", balance: 100 }, { id: "b", balance: -100 }]);
    expect(t).toEqual([{ fromMemberId: "b", toMemberId: "a", amount: 100 }]);
  });

  it("ignores zero-net members and preserves every net exactly", () => {
    const t = previewTransfers([
      { id: "a", balance: 90 },
      { id: "b", balance: 50 },
      { id: "c", balance: 0 },
      { id: "d", balance: -140 },
    ]);
    expect(t.reduce((s, x) => s + x.amount, 0)).toBe(140);
    for (const x of t) expect(x.toMemberId === "a" || x.toMemberId === "b").toBe(true);
    expect(t.some((x) => x.fromMemberId === "c" || x.toMemberId === "c")).toBe(false);
  });
});
