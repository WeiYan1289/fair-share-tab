import { describe, expect, it } from "vitest";
import { createGroupSchema, updateGroupSchema } from "./group";

describe("createGroupSchema", () => {
  it("accepts a name and creatorName with no currency field", () => {
    const result = createGroupSchema.safeParse({
      name: "Trip Squad",
      creatorName: "Sarah",
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "Trip Squad", creatorName: "Sarah" });
  });

  it("rejects a blank name", () => {
    expect(createGroupSchema.safeParse({ name: "  ", creatorName: "Sarah" }).success).toBe(false);
  });

  it("rejects a blank creatorName", () => {
    expect(createGroupSchema.safeParse({ name: "Trip Squad", creatorName: "" }).success).toBe(
      false,
    );
  });
});

describe("updateGroupSchema", () => {
  it("accepts a plain rename and trims it", () => {
    const parsed = updateGroupSchema.parse({ name: "  Bali Trip Crew  " });
    expect(parsed.name).toBe("Bali Trip Crew");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(updateGroupSchema.safeParse({ name: "" }).success).toBe(false);
    expect(updateGroupSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects an empty payload", () => {
    expect(updateGroupSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a status-only archive", () => {
    expect(updateGroupSchema.safeParse({ status: "archived" }).success).toBe(true);
  });

  it("rejects an unknown status", () => {
    expect(updateGroupSchema.safeParse({ status: "deleted" }).success).toBe(false);
  });
});
