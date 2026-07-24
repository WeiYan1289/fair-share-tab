import { describe, expect, it } from "vitest";
import { createEventSchema, updateEventSchema } from "./event";

describe("createEventSchema", () => {
  it("defaults currency to MYR when omitted", () => {
    const result = createEventSchema.safeParse({ name: "Tokyo Trip" });
    expect(result.success).toBe(true);
    expect(result.data?.currency).toBe("MYR");
  });

  it("accepts a curated currency code", () => {
    const result = createEventSchema.safeParse({ name: "Tokyo Trip", currency: "JPY" });
    expect(result.success).toBe(true);
    expect(result.data?.currency).toBe("JPY");
  });

  it("rejects a currency code outside the curated list", () => {
    const result = createEventSchema.safeParse({ name: "Seoul Trip", currency: "KRW" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    expect(createEventSchema.safeParse({ name: "  " }).success).toBe(false);
  });
});

describe("updateEventSchema", () => {
  it("does not accept a currency field (currency is locked after creation)", () => {
    const result = updateEventSchema.safeParse({ name: "Renamed Trip", currency: "USD" });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("currency");
  });

  it("still requires at least one field", () => {
    expect(updateEventSchema.safeParse({}).success).toBe(false);
  });
});
