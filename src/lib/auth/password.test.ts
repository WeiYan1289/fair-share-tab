import { describe, expect, it } from "vitest";
import { getDummyHash, hashPassword, verifyPassword } from "./password";

describe("hashPassword / verifyPassword", () => {
  it("round-trips a correct password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(await verifyPassword(hash, "wrong password")).toBe(false);
  });

  it("salts hashes — the same plaintext hashed twice differs", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");

    expect(a).not.toBe(b);
    expect(await verifyPassword(a, "same password")).toBe(true);
    expect(await verifyPassword(b, "same password")).toBe(true);
  });

  it("produces a real argon2id hash string", async () => {
    const hash = await hashPassword("whatever");

    expect(hash.startsWith("$argon2id$")).toBe(true);
  });

  it("rejects hashing an over-length password", async () => {
    await expect(hashPassword("a".repeat(257))).rejects.toThrow();
  });

  it("verifyPassword returns false (not throw) for an over-length attempt", async () => {
    const hash = await hashPassword("normal password");

    expect(await verifyPassword(hash, "a".repeat(257))).toBe(false);
  });

  it("verifyPassword returns false for a malformed hash instead of throwing", async () => {
    expect(await verifyPassword("not-a-real-hash", "anything")).toBe(false);
  });
});

describe("getDummyHash", () => {
  it("returns a stable, real argon2id hash usable with verifyPassword", async () => {
    const hash = await getDummyHash();

    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await getDummyHash()).toBe(hash);
    expect(await verifyPassword(hash, "anything")).toBe(false);
  });
});
