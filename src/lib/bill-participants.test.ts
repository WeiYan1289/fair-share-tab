import { describe, it, expect } from "vitest";
import { collectBillParticipants, selectBillParticipants } from "./bill-participants";

const members = [
  { id: "m1", name: "Melody", avatarColor: "#a" },
  { id: "m2", name: "Alice", avatarColor: "#b" },
  { id: "m3", name: "Eric", avatarColor: "#c" },
];

describe("collectBillParticipants", () => {
  it("returns nobody for an event with no bills", () => {
    expect(collectBillParticipants([]).size).toBe(0);
  });

  it("counts everyone a bill was split between", () => {
    const ids = collectBillParticipants([
      { payerId: "a", splits: [{ memberId: "a" }, { memberId: "b" }] },
    ]);

    expect([...ids].sort()).toEqual(["a", "b"]);
  });

  // Payer and participants are independent (CLAUDE.md): someone can pay for
  // a bill they are not part of. They still took part in the event, so a
  // balance of zero for them means "square", not "never involved".
  it("counts the payer even when they are not in the splits", () => {
    const ids = collectBillParticipants([{ payerId: "payer", splits: [{ memberId: "b" }] }]);

    expect(ids.has("payer")).toBe(true);
  });

  it("counts a member across separate bills without duplicating them", () => {
    const ids = collectBillParticipants([
      { payerId: "a", splits: [{ memberId: "a" }] },
      { payerId: "b", splits: [{ memberId: "a" }, { memberId: "b" }] },
    ]);

    expect(ids.size).toBe(2);
  });

  // Settled bills still count. Someone whose bills are all settled did take
  // part and genuinely is square -- they must not be labelled as uninvolved.
  it("does not care whether a bill is settled", () => {
    const ids = collectBillParticipants([{ payerId: "a", splits: [{ memberId: "b" }] }]);

    expect(ids.size).toBe(2);
  });
});

describe("selectBillParticipants", () => {
  it("keeps members with a positive share", () => {
    const splits = [
      { memberId: "m1", shareAmount: 100 },
      { memberId: "m2", shareAmount: 100 },
    ];
    expect(selectBillParticipants(splits, members)).toEqual([members[0], members[1]]);
  });

  it("excludes members whose share is 0 (display-only zero exclusion)", () => {
    const splits = [
      { memberId: "m1", shareAmount: 100 },
      { memberId: "m2", shareAmount: 0 },
      { memberId: "m3", shareAmount: 50 },
    ];
    expect(selectBillParticipants(splits, members)).toEqual([members[0], members[2]]);
  });

  it("returns canonical member order regardless of split order", () => {
    const splits = [
      { memberId: "m3", shareAmount: 50 },
      { memberId: "m1", shareAmount: 100 },
    ];
    expect(selectBillParticipants(splits, members)).toEqual([members[0], members[2]]);
  });

  it("handles the tiny-total equal split (1,0,0) — only the first survives", () => {
    const splits = [
      { memberId: "m1", shareAmount: 1 },
      { memberId: "m2", shareAmount: 0 },
      { memberId: "m3", shareAmount: 0 },
    ];
    expect(selectBillParticipants(splits, members)).toEqual([members[0]]);
  });
});
