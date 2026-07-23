import { describe, expect, it } from "vitest";
import { generateShareToken } from "./token";

describe("generateShareToken", () => {
  it("generates a 22-character base62 token by default", () => {
    const token = generateShareToken();

    expect(token).toHaveLength(22);
    expect(token).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("generates unique tokens across many calls", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateShareToken()));

    expect(tokens.size).toBe(1000);
  });

  it("supports a custom length", () => {
    expect(generateShareToken(10)).toHaveLength(10);
  });
});
