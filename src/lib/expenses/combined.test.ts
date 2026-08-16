import { describe, expect, it } from "vitest";
import { computeCombinedBalances, memberTransfersFrom } from "./combined";
import type { Transfer } from "@/lib/settlement";

const ALICE = "a";
const BOB = "b";
const CARL = "c";

// Alice paid for Bob in two separate MYR events; combined, Bob owes Alice once.
const twoMyrEvents = [
  {
    eventId: "e1",
    currency: "MYR",
    bills: [{ payerId: ALICE, totalAmount: 1000, splits: [{ memberId: BOB, shareAmount: 1000 }] }],
  },
  {
    eventId: "e2",
    currency: "MYR",
    bills: [{ payerId: ALICE, totalAmount: 500, splits: [{ memberId: BOB, shareAmount: 500 }] }],
  },
];

describe("computeCombinedBalances", () => {
  it("nets a member across >= 2 same-currency events into one transfer set", () => {
    const [result] = computeCombinedBalances(twoMyrEvents);
    expect(result.currency).toBe("MYR");
    expect(result.eventCount).toBe(2);
    expect(result.eventIds).toEqual(["e1", "e2"]);
    expect(result.unsettledTotal).toBe(1500);
    expect(result.memberNets.get(ALICE)).toBe(1500);
    expect(result.memberNets.get(BOB)).toBe(-1500);
    expect(result.transfers).toEqual([{ fromMemberId: BOB, toMemberId: ALICE, amount: 1500 }]);
  });

  it("excludes a currency carried by only one event (gating < 2)", () => {
    const results = computeCombinedBalances([twoMyrEvents[0]]);
    expect(results).toEqual([]);
  });

  it("never sums across currencies: partitions MYR and JPY separately", () => {
    const results = computeCombinedBalances([
      ...twoMyrEvents,
      { eventId: "j1", currency: "JPY", bills: [{ payerId: ALICE, totalAmount: 1500, splits: [{ memberId: BOB, shareAmount: 1500 }] }] },
      { eventId: "j2", currency: "JPY", bills: [{ payerId: BOB, totalAmount: 500, splits: [{ memberId: ALICE, shareAmount: 500 }] }] },
    ]);
    const myr = results.find((r) => r.currency === "MYR")!;
    const jpy = results.find((r) => r.currency === "JPY")!;
    expect(myr.memberNets.get(ALICE)).toBe(1500);
    // JPY nets independently: Alice +1500 -500 = +1000, never mixed with MYR.
    expect(jpy.memberNets.get(ALICE)).toBe(1000);
    expect(jpy.unsettledTotal).toBe(2000);
  });

  it("ignores events with no unsettled bills when counting toward the gate", () => {
    const results = computeCombinedBalances([
      twoMyrEvents[0],
      { eventId: "empty", currency: "MYR", bills: [] },
    ]);
    expect(results).toEqual([]); // only one event actually carries money
  });
});

describe("memberTransfersFrom", () => {
  const transfers: Transfer[] = [
    { fromMemberId: BOB, toMemberId: ALICE, amount: 1500 },
    { fromMemberId: CARL, toMemberId: ALICE, amount: 200 },
  ];

  it("keeps only transfers touching the member, with direction from their side", () => {
    expect(memberTransfersFrom(transfers, ALICE)).toEqual([
      { otherMemberId: BOB, direction: "receives", amount: 1500 },
      { otherMemberId: CARL, direction: "receives", amount: 200 },
    ]);
    expect(memberTransfersFrom(transfers, BOB)).toEqual([
      { otherMemberId: ALICE, direction: "pays", amount: 1500 },
    ]);
  });
});
