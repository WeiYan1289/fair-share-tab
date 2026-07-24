import { describe, expect, it } from "vitest";
import { createGroupSchema } from "./group";

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
