import { describe, expect, it } from "vitest";
import { generateResetToken, hashResetToken } from "./reset-token";

describe("generateResetToken", () => {
  it("generates a 32-character base62 token", () => {
    const token = generateResetToken();

    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[0-9A-Za-z]+$/);
  });

  it("generates unique tokens across many calls", () => {
    const tokens = new Set(Array.from({ length: 1000 }, () => generateResetToken()));

    expect(tokens.size).toBe(1000);
  });
});

describe("hashResetToken", () => {
  it("is deterministic, so a token can be looked up by its stored hash", () => {
    expect(hashResetToken("abc123")).toBe(hashResetToken("abc123"));
  });

  it("never returns the token itself", () => {
    expect(hashResetToken("abc123")).not.toBe("abc123");
  });

  it("returns a different hash for a different token", () => {
    expect(hashResetToken("abc123")).not.toBe(hashResetToken("abc124"));
  });

  it("returns a 64-character lowercase hex SHA-256 digest", () => {
    expect(hashResetToken(generateResetToken())).toMatch(/^[0-9a-f]{64}$/);
  });
});
