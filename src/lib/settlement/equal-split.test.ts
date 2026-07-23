import { describe, expect, it } from "vitest";
import { computeEqualSplit, splitsReconcile } from "./equal-split";
import type { EqualSplitParticipant } from "./types";

function participant(memberId: string, createdAt: string): EqualSplitParticipant {
  return { memberId, createdAt: new Date(createdAt) };
}

describe("computeEqualSplit", () => {
  it("divides evenly when the total divides cleanly", () => {
    const participants = [
      participant("m1", "2026-01-01"),
      participant("m2", "2026-01-02"),
      participant("m3", "2026-01-03"),
    ];

    const shares = computeEqualSplit(9000, participants, "m1");

    expect(shares).toEqual(
      expect.arrayContaining([
        { memberId: "m1", shareAmount: 3000 },
        { memberId: "m2", shareAmount: 3000 },
        { memberId: "m3", shareAmount: 3000 },
      ]),
    );
    expect(shares.reduce((sum, s) => sum + s.shareAmount, 0)).toBe(9000);
  });

  it("gives the leftover sen to the payer first when remainder is 1", () => {
    // RM250.00 / 3 -> 8334 / 8333 / 8333, extra sen to the payer.
    const participants = [
      participant("m1", "2026-01-01"),
      participant("m2", "2026-01-02"),
      participant("m3", "2026-01-03"),
    ];

    const shares = computeEqualSplit(25000, participants, "m2");
    const byMember = Object.fromEntries(shares.map((s) => [s.memberId, s.shareAmount]));

    expect(byMember.m2).toBe(8334);
    expect(byMember.m1).toBe(8333);
    expect(byMember.m3).toBe(8333);
    expect(shares.reduce((sum, s) => sum + s.shareAmount, 0)).toBe(25000);
  });

  it("distributes a remainder of n-1 sen: payer first, then by createdAt", () => {
    // total 9998 among 3 -> base 3332, remainder 2.
    const participants = [
      participant("m1", "2026-01-03"),
      participant("m2", "2026-01-01"),
      participant("m3", "2026-01-02"),
    ];

    const shares = computeEqualSplit(9998, participants, "m1");
    const byMember = Object.fromEntries(shares.map((s) => [s.memberId, s.shareAmount]));

    // payer (m1) gets the first extra sen, then m2 (earlier of the remaining two by createdAt).
    expect(byMember.m1).toBe(3333);
    expect(byMember.m2).toBe(3333);
    expect(byMember.m3).toBe(3332);
    expect(shares.reduce((sum, s) => sum + s.shareAmount, 0)).toBe(9998);
  });

  it("distributes remainder by createdAt order when the payer is not a participant", () => {
    const participants = [
      participant("m1", "2026-01-03"),
      participant("m2", "2026-01-01"),
      participant("m3", "2026-01-02"),
    ];

    const shares = computeEqualSplit(100, participants, "someone-else");
    const byMember = Object.fromEntries(shares.map((s) => [s.memberId, s.shareAmount]));

    // base = 33, remainder = 1 -> earliest created participant (m2) gets it.
    expect(byMember.m2).toBe(34);
    expect(byMember.m1).toBe(33);
    expect(byMember.m3).toBe(33);
    expect(shares.reduce((sum, s) => sum + s.shareAmount, 0)).toBe(100);
  });

  it("assigns the full amount to a single participant", () => {
    const shares = computeEqualSplit(4200, [participant("m1", "2026-01-01")], "m1");

    expect(shares).toEqual([{ memberId: "m1", shareAmount: 4200 }]);
  });
});

describe("splitsReconcile", () => {
  it("accepts a custom split that sums to the total", () => {
    const reconciled = splitsReconcile(9000, [
      { memberId: "m1", shareAmount: 5000 },
      { memberId: "m2", shareAmount: 4000 },
    ]);

    expect(reconciled).toBe(true);
  });

  it("rejects a custom split that does not sum to the total", () => {
    const reconciled = splitsReconcile(9000, [
      { memberId: "m1", shareAmount: 5000 },
      { memberId: "m2", shareAmount: 3000 },
    ]);

    expect(reconciled).toBe(false);
  });
});
