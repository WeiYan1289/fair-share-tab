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

  it("accepts KRW, the second zero-decimal currency", () => {
    const result = createEventSchema.safeParse({ name: "Seoul Trip", currency: "KRW" });
    expect(result.success).toBe(true);
    expect(result.data?.currency).toBe("KRW");
  });

  it("rejects a currency code outside the curated list", () => {
    const result = createEventSchema.safeParse({ name: "Zurich Trip", currency: "CHF" });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    expect(createEventSchema.safeParse({ name: "  " }).success).toBe(false);
  });

  it("rejects a start date after the end date", () => {
    const result = createEventSchema.safeParse({
      name: "Tokyo Trip",
      startDate: "2026-08-10",
      endDate: "2026-08-05",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a start date on or before the end date", () => {
    expect(
      createEventSchema.safeParse({
        name: "Tokyo Trip",
        startDate: "2026-08-05",
        endDate: "2026-08-05",
      }).success,
    ).toBe(true);
    expect(
      createEventSchema.safeParse({
        name: "Tokyo Trip",
        startDate: "2026-08-05",
        endDate: "2026-08-10",
      }).success,
    ).toBe(true);
  });

  it("accepts when only one date is set", () => {
    expect(
      createEventSchema.safeParse({ name: "Tokyo Trip", startDate: "2026-08-05" }).success,
    ).toBe(true);
    expect(
      createEventSchema.safeParse({ name: "Tokyo Trip", endDate: "2026-08-05" }).success,
    ).toBe(true);
  });
});

describe("updateEventSchema", () => {
  // Currency used to be stripped here, which made the schema the lock. It
  // isn't anymore: the edit-event modal may change currency while an event
  // has no bills, and the "no bills" part is a database question the schema
  // cannot answer. The lock now lives in the PATCH route, which counts bills
  // and 409s. This test only pins that the field survives parsing -- if it
  // ever gets stripped again the route's check becomes unreachable and the
  // whole feature silently no-ops.
  it("passes currency through for the route to authorize", () => {
    const result = updateEventSchema.safeParse({ name: "Renamed Trip", currency: "USD" });
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty("currency", "USD");
  });

  it("rejects a currency outside the curated list", () => {
    expect(updateEventSchema.safeParse({ currency: "XYZ" }).success).toBe(false);
  });

  it("accepts a currency change as the only field", () => {
    expect(updateEventSchema.safeParse({ currency: "JPY" }).success).toBe(true);
  });

  it("still requires at least one field", () => {
    expect(updateEventSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a start date after the end date", () => {
    const result = updateEventSchema.safeParse({
      startDate: "2026-08-10",
      endDate: "2026-08-05",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a start date on or before the end date", () => {
    expect(
      updateEventSchema.safeParse({ startDate: "2026-08-05", endDate: "2026-08-10" }).success,
    ).toBe(true);
  });
});
