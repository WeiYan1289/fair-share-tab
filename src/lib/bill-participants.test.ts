import { describe, expect, it } from "vitest";
import { collectBillParticipants } from "./bill-participants";

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
