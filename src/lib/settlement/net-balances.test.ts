import { describe, expect, it } from "vitest";
import { computeNetBalances } from "./net-balances";
import type { BillForNetting } from "./types";

describe("computeNetBalances", () => {
  it("nets a mixed set of bills so every member's balance sums to zero", () => {
    const bills: BillForNetting[] = [
      {
        payerId: "m1",
        totalAmount: 9000,
        splits: [
          { memberId: "m1", shareAmount: 3000 },
          { memberId: "m2", shareAmount: 3000 },
          { memberId: "m3", shareAmount: 3000 },
        ],
      },
      {
        payerId: "m2",
        totalAmount: 6000,
        splits: [
          { memberId: "m2", shareAmount: 2000 },
          { memberId: "m3", shareAmount: 4000 },
        ],
      },
    ];

    const nets = computeNetBalances(bills);

    expect(nets.get("m1")).toBe(6000);
    expect(nets.get("m2")).toBe(1000);
    expect(nets.get("m3")).toBe(-7000);

    const total = [...nets.values()].reduce((sum, n) => sum + n, 0);
    expect(total).toBe(0);
  });

  it("never adds an entry for a member who neither paid nor participated", () => {
    const bills: BillForNetting[] = [
      {
        payerId: "m1",
        totalAmount: 1000,
        splits: [{ memberId: "m1", shareAmount: 1000 }],
      },
    ];

    const nets = computeNetBalances(bills);

    expect(nets.has("m-uninvolved")).toBe(false);
  });
});
