import { describe, expect, it } from "vitest";
import { forgotSchema, loginSchema, registerSchema, resetSchema } from "./auth";

describe("registerSchema", () => {
  it("accepts a valid email and password, normalizing email case", () => {
    const result = registerSchema.safeParse({ email: "Sarah@Example.com", password: "correcthorse" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: "sarah@example.com", password: "correcthorse" });
  });

  it("rejects a malformed email", () => {
    expect(registerSchema.safeParse({ email: "not-an-email", password: "correcthorse" }).success).toBe(
      false,
    );
  });

  it("rejects a blank email", () => {
    expect(registerSchema.safeParse({ email: "", password: "correcthorse" }).success).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(registerSchema.safeParse({ email: "sarah@example.com", password: "short" }).success).toBe(
      false,
    );
  });

  it("rejects a password over the max length", () => {
    expect(
      registerSchema.safeParse({ email: "sarah@example.com", password: "a".repeat(257) }).success,
    ).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    const result = loginSchema.safeParse({ email: "sarah@example.com", password: "x" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "sarah@example.com", password: "" }).success).toBe(false);
  });

  it("does not enforce an 8-character minimum on login (unlike register)", () => {
    // A short login password must still be allowed to fail with "wrong
    // password" from the server, not a client-side length rejection that
    // would leak the 8-char rule as a hint during login.
    expect(loginSchema.safeParse({ email: "sarah@example.com", password: "short" }).success).toBe(true);
  });
});

describe("forgotSchema", () => {
  it("accepts a valid email, normalizing case the same way register does", () => {
    const result = forgotSchema.safeParse({ email: "Sarah@Example.com" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ email: "sarah@example.com" });
  });

  it("rejects a malformed email", () => {
    expect(forgotSchema.safeParse({ email: "not-an-email" }).success).toBe(false);
  });
});

describe("resetSchema", () => {
  const token = "a".repeat(32);

  it("accepts a well-formed token and a new password", () => {
    expect(resetSchema.safeParse({ token, newPassword: "correcthorse" }).success).toBe(true);
  });

  it("enforces the same 8-character minimum as registration", () => {
    expect(resetSchema.safeParse({ token, newPassword: "short" }).success).toBe(false);
  });

  it("rejects a password over the max length", () => {
    expect(resetSchema.safeParse({ token, newPassword: "a".repeat(257) }).success).toBe(false);
  });

  // Malformed tokens are rejected before any database lookup, so guessing
  // traffic never reaches the token index.
  it("rejects a token of the wrong length", () => {
    expect(resetSchema.safeParse({ token: "a".repeat(31), newPassword: "correcthorse" }).success).toBe(
      false,
    );
  });

  it("rejects a token containing non-base62 characters", () => {
    expect(
      resetSchema.safeParse({ token: `${"a".repeat(31)}-`, newPassword: "correcthorse" }).success,
    ).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(resetSchema.safeParse({ newPassword: "correcthorse" }).success).toBe(false);
  });
});
