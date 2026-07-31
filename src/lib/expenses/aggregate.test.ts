import { describe, expect, it } from "vitest";
import { computeMemberEventBalance, computeMemberEventExpense, type ExpenseBill } from "./aggregate";

const ALICE = "alice";
const BOB = "bob";
const CAROL = "carol";

function bill(overrides: Partial<ExpenseBill> & Pick<ExpenseBill, "billId" | "payerId">): ExpenseBill {
  return {
    title: "Bill",
    totalAmount: 1000,
    createdAt: new Date("2026-01-01"),
    splits: [],
    ...overrides,
  };
}

describe("computeMemberEventExpense", () => {
  it("counts a bill where the member is the payer but not a participant", () => {
    const bills = [bill({ billId: "b1", payerId: ALICE, totalAmount: 900, splits: [{ memberId: BOB, shareAmount: 900 }] })];

    const result = computeMemberEventExpense(ALICE, bills);

    expect(result.paid).toBe(900);
    expect(result.share).toBe(0);
    expect(result.lines).toEqual([
      { billId: "b1", title: "Bill", totalAmount: 900, payerId: ALICE, isPayer: true, shareAmount: 0, createdAt: bills[0].createdAt },
    ]);
  });

  it("counts a bill where the member is a participant but not the payer", () => {
    const bills = [
      bill({
        billId: "b1",
        payerId: BOB,
        totalAmount: 900,
        splits: [
          { memberId: ALICE, shareAmount: 300 },
          { memberId: BOB, shareAmount: 600 },
        ],
      }),
    ];

    const result = computeMemberEventExpense(ALICE, bills);

    expect(result.paid).toBe(0);
    expect(result.share).toBe(300);
    expect(result.lines[0]).toMatchObject({ isPayer: false, shareAmount: 300 });
  });

  it("counts both paid and share when the member is payer and participant", () => {
    const bills = [
      bill({
        billId: "b1",
        payerId: ALICE,
        totalAmount: 1000,
        splits: [
          { memberId: ALICE, shareAmount: 500 },
          { memberId: BOB, shareAmount: 500 },
        ],
      }),
    ];

    const result = computeMemberEventExpense(ALICE, bills);

    expect(result.paid).toBe(1000);
    expect(result.share).toBe(500);
    expect(result.lines[0]).toMatchObject({ isPayer: true, shareAmount: 500 });
  });

  it("excludes a bill the member has no connection to", () => {
    const bills = [
      bill({
        billId: "b1",
        payerId: BOB,
        totalAmount: 200,
        splits: [{ memberId: CAROL, shareAmount: 200 }],
      }),
    ];

    const result = computeMemberEventExpense(ALICE, bills);

    expect(result.paid).toBe(0);
    expect(result.share).toBe(0);
    expect(result.lines).toEqual([]);
  });

  it("has no notion of settled/unsettled -- it aggregates whatever bills it's given", () => {
    // Standing in for a settled bill: computeMemberEventExpense doesn't
    // take a status at all, so passing it here (as the caller would for
    // spend history) still counts toward share/paid. Filtering by status
    // is the wrapper's job (getMemberExpenses passes every bill; a
    // balance view would pass only unsettled ones) -- never this
    // function's.
    const settledBill = bill({
      billId: "settled-1",
      payerId: BOB,
      totalAmount: 400,
      splits: [{ memberId: ALICE, shareAmount: 400 }],
    });

    const result = computeMemberEventExpense(ALICE, [settledBill]);

    expect(result.share).toBe(400);
  });

  it("sums across multiple bills and sorts lines newest first", () => {
    const older = bill({
      billId: "b-older",
      payerId: ALICE,
      totalAmount: 100,
      createdAt: new Date("2026-01-01"),
      splits: [{ memberId: ALICE, shareAmount: 100 }],
    });
    const newer = bill({
      billId: "b-newer",
      payerId: BOB,
      totalAmount: 50,
      createdAt: new Date("2026-01-05"),
      splits: [{ memberId: ALICE, shareAmount: 50 }],
    });

    const result = computeMemberEventExpense(ALICE, [older, newer]);

    expect(result.share).toBe(150);
    expect(result.paid).toBe(100);
    expect(result.lines.map((l) => l.billId)).toEqual(["b-newer", "b-older"]);
  });

  it("returns zeroes and an empty line list for a member with no bills at all", () => {
    const result = computeMemberEventExpense(ALICE, []);

    expect(result).toEqual({ share: 0, paid: 0, lines: [] });
  });
});

describe("computeMemberEventBalance", () => {
  it("returns zero net and no transfers when nothing is unsettled", () => {
    const result = computeMemberEventBalance(ALICE, []);
    expect(result).toEqual({ net: 0, transfers: [] });
  });

  it("returns zero net and no transfers for a member whose net is exactly zero", () => {
    // Alice paid 1000 split evenly 500/500 with Bob and also owes Bob a
    // separate 500 -- nets to exactly zero for Alice.
    const bills = [
      { payerId: ALICE, totalAmount: 1000, splits: [{ memberId: ALICE, shareAmount: 500 }, { memberId: BOB, shareAmount: 500 }] },
      { payerId: BOB, totalAmount: 500, splits: [{ memberId: ALICE, shareAmount: 500 }] },
    ];
    const result = computeMemberEventBalance(ALICE, bills);
    expect(result).toEqual({ net: 0, transfers: [] });
  });

  it("computes a simple 1-to-1 debt as a single transfer", () => {
    const bills = [
      { payerId: ALICE, totalAmount: 1000, splits: [{ memberId: ALICE, shareAmount: 500 }, { memberId: BOB, shareAmount: 500 }] },
    ];
    const result = computeMemberEventBalance(BOB, bills);
    expect(result.net).toBe(-500);
    expect(result.transfers).toEqual([{ otherMemberId: ALICE, direction: "pays", amount: 500 }]);
  });

  it("labels the other side as 'receives' when this member is the creditor", () => {
    const bills = [
      { payerId: ALICE, totalAmount: 1000, splits: [{ memberId: ALICE, shareAmount: 500 }, { memberId: BOB, shareAmount: 500 }] },
    ];
    const result = computeMemberEventBalance(ALICE, bills);
    expect(result.net).toBe(500);
    expect(result.transfers).toEqual([{ otherMemberId: BOB, direction: "receives", amount: 500 }]);
  });

  it("filters simplified transfers down to only the ones touching this member", () => {
    // Carol pays for everyone; both Alice and Bob owe Carol. Asking for
    // Alice's balance must not include the Bob->Carol transfer.
    const bills = [
      {
        payerId: CAROL,
        totalAmount: 900,
        splits: [
          { memberId: ALICE, shareAmount: 300 },
          { memberId: BOB, shareAmount: 300 },
          { memberId: CAROL, shareAmount: 300 },
        ],
      },
    ];
    const result = computeMemberEventBalance(ALICE, bills);
    expect(result.net).toBe(-300);
    expect(result.transfers).toEqual([{ otherMemberId: CAROL, direction: "pays", amount: 300 }]);
  });
});
