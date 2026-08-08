import { describe, expect, it } from "vitest";
import { billSchema } from "./bill";

const BLOB = "https://abc123.public.blob.vercel-storage.com/receipts/g/x.jpg";

function equalBill(extra: Record<string, unknown> = {}) {
  return {
    title: "Nabe Dinner",
    totalAmount: 25000,
    payerId: "11111111-1111-4111-8111-111111111111",
    splitMethod: "equal",
    participantIds: ["11111111-1111-4111-8111-111111111111"],
    ...extra,
  };
}

describe("billSchema receiptUrl", () => {
  it("accepts a valid blob URL", () => {
    const parsed = billSchema.safeParse(equalBill({ receiptUrl: BLOB }));
    expect(parsed.success).toBe(true);
  });

  // Absence is how a receipt is removed -- PATCH is a full replace, so an
  // omitted receiptUrl means "this bill has no receipt".
  it("accepts the field being absent", () => {
    const parsed = billSchema.safeParse(equalBill());
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.receiptUrl).toBeUndefined();
  });

  it("rejects a foreign host", () => {
    const parsed = billSchema.safeParse(equalBill({ receiptUrl: "https://evil.example.com/x.jpg" }));
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-URL string", () => {
    const parsed = billSchema.safeParse(equalBill({ receiptUrl: "nope" }));
    expect(parsed.success).toBe(false);
  });
});
