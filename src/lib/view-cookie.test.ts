import { describe, it, expect } from "vitest";
import { parseCollapsed, serializeCollapsed } from "./view-cookie";

describe("collapsed cookie", () => {
  it("parses undefined/empty to an empty set", () => {
    expect(parseCollapsed(undefined).size).toBe(0);
    expect(parseCollapsed("").size).toBe(0);
  });

  it("round-trips a set of ids", () => {
    const set = new Set(["e1", "e2"]);
    expect(parseCollapsed(serializeCollapsed(set))).toEqual(set);
  });

  it("ignores blanks and whitespace", () => {
    expect(parseCollapsed(" e1 , , e2 ")).toEqual(new Set(["e1", "e2"]));
  });
});
