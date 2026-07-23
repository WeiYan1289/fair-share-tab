import { describe, expect, it } from "vitest";
import { simplifyDebts } from "./simplify-debts";
import type { NetBalances, Transfer } from "./types";

/** Reconstructs each member's net change implied by a set of transfers. */
function netDeltaFromTransfers(transfers: Transfer[]): Map<string, number> {
  const delta = new Map<string, number>();
  for (const t of transfers) {
    delta.set(t.fromMemberId, (delta.get(t.fromMemberId) ?? 0) - t.amount);
    delta.set(t.toMemberId, (delta.get(t.toMemberId) ?? 0) + t.amount);
  }
  return delta;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** A random net-balance map, guaranteed to sum to zero. */
function randomNets(memberCount: number): NetBalances {
  const nets: NetBalances = new Map();
  let runningTotal = 0;
  for (let i = 0; i < memberCount - 1; i++) {
    const net = randomInt(-10_000, 10_000);
    nets.set(`m${i}`, net);
    runningTotal += net;
  }
  nets.set(`m${memberCount - 1}`, -runningTotal);
  return nets;
}

describe("simplifyDebts", () => {
  it("preserves every member's net position exactly", () => {
    const nets: NetBalances = new Map([
      ["m1", 6000],
      ["m2", 1000],
      ["m3", -7000],
    ]);

    const transfers = simplifyDebts(nets);
    const delta = netDeltaFromTransfers(transfers);

    for (const [memberId, net] of nets) {
      expect(delta.get(memberId) ?? 0).toBe(net);
    }
  });

  it("returns at most N-1 transfers for N members with a nonzero net", () => {
    const nets: NetBalances = new Map([
      ["m1", 5000],
      ["m2", 3000],
      ["m3", 2000],
      ["m4", -4000],
      ["m5", -6000],
    ]);

    const transfers = simplifyDebts(nets);

    expect(transfers.length).toBeLessThanOrEqual(4);
  });

  it("returns zero transfers for an already-balanced group", () => {
    const nets: NetBalances = new Map([
      ["m1", 0],
      ["m2", 0],
      ["m3", 0],
    ]);

    expect(simplifyDebts(nets)).toEqual([]);
  });

  it("never includes a member with a zero net in any transfer", () => {
    const nets: NetBalances = new Map([
      ["m1", 5000],
      ["m2", 0],
      ["m3", -5000],
    ]);

    const transfers = simplifyDebts(nets);

    for (const t of transfers) {
      expect(t.fromMemberId).not.toBe("m2");
      expect(t.toMemberId).not.toBe("m2");
    }
  });

  it("property: preserves every member's net exactly across random balanced inputs", () => {
    for (let trial = 0; trial < 200; trial++) {
      const memberCount = randomInt(2, 8);
      const nets = randomNets(memberCount);

      const transfers = simplifyDebts(nets);
      const delta = netDeltaFromTransfers(transfers);

      for (const [memberId, net] of nets) {
        expect(delta.get(memberId) ?? 0).toBe(net);
      }

      const nonzeroCount = [...nets.values()].filter((n) => n !== 0).length;
      if (nonzeroCount === 0) {
        expect(transfers.length).toBe(0);
      } else {
        expect(transfers.length).toBeLessThanOrEqual(nonzeroCount - 1);
      }
    }
  });
});
