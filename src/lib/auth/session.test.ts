import { beforeAll, describe, expect, it } from "vitest";
import { signSession, signUserSession, verifySession, verifyUserSession, signValue } from "./session";
import type { SignableSessionPayload } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-do-not-use-in-production";
});

const linkPayload: SignableSessionPayload = {
  kind: "link",
  groupId: "11111111-1111-1111-1111-111111111111",
  role: "editor",
  shareLinkId: "22222222-2222-2222-2222-222222222222",
};

const memberPayload: SignableSessionPayload = {
  kind: "member",
  groupId: "11111111-1111-1111-1111-111111111111",
  role: "editor",
  userId: "33333333-3333-3333-3333-333333333333",
  membershipId: "44444444-4444-4444-4444-444444444444",
};

describe("signSession / verifySession", () => {
  it("round-trips a valid link-kind payload", () => {
    const cookieValue = signSession(linkPayload);

    expect(verifySession(cookieValue)).toEqual(linkPayload);
  });

  it("round-trips a valid member-kind payload, stamping issuedAt", () => {
    const before = Date.now();
    const cookieValue = signSession(memberPayload);

    const verified = verifySession(cookieValue);

    expect(verified).toEqual({ ...memberPayload, issuedAt: expect.any(Number) });
    expect(verified && "issuedAt" in verified && verified.issuedAt).toBeGreaterThanOrEqual(before);
  });

  it("treats a payload with no `kind` as a link session (back-compat)", () => {
    const legacyPayload = {
      groupId: linkPayload.groupId,
      role: linkPayload.role,
      shareLinkId: linkPayload.shareLinkId,
    };
    const cookieValue = signValue(legacyPayload);

    expect(verifySession(cookieValue)).toEqual({ kind: "link", ...legacyPayload });
  });

  it("rejects a tampered payload", () => {
    const cookieValue = signSession(linkPayload);
    const [, signature] = cookieValue.split(".");
    const tamperedBody = Buffer.from(
      JSON.stringify({ ...linkPayload, role: linkPayload.role === "editor" ? "viewer" : "editor" }),
    ).toString("base64url");

    expect(verifySession(`${tamperedBody}.${signature}`)).toBeNull();
  });

  it("rejects a malformed cookie value", () => {
    expect(verifySession("not-a-valid-cookie")).toBeNull();
    expect(verifySession("")).toBeNull();
    expect(verifySession(undefined)).toBeNull();
    expect(verifySession(null)).toBeNull();
  });

  it("rejects a payload signed with a different secret", () => {
    const cookieValue = signSession(linkPayload);
    process.env.SESSION_SECRET = "a-different-secret";

    expect(verifySession(cookieValue)).toBeNull();

    process.env.SESSION_SECRET = "test-secret-do-not-use-in-production";
  });

  it("rejects a member-kind payload missing userId/membershipId", () => {
    const cookieValue = signValue({ kind: "member", groupId: linkPayload.groupId, role: "editor" });

    expect(verifySession(cookieValue)).toBeNull();
  });

  // Unlike a missing `kind`, which is tolerated as a legacy link session, a
  // member cookie with no issuedAt cannot be checked against
  // password_changed_at — so it must be rejected rather than trusted.
  it("rejects a member-kind payload with no issuedAt", () => {
    const cookieValue = signValue(memberPayload);

    expect(verifySession(cookieValue)).toBeNull();
  });

  it("still accepts a legacy link session, which carries no issuedAt", () => {
    const cookieValue = signValue(linkPayload);

    expect(verifySession(cookieValue)).toEqual(linkPayload);
  });
});

describe("signUserSession / verifyUserSession", () => {
  const userPayload = { userId: "55555555-5555-5555-5555-555555555555" };

  it("round-trips a valid payload, stamping issuedAt", () => {
    const before = Date.now();
    const cookieValue = signUserSession(userPayload);

    const verified = verifyUserSession(cookieValue);

    expect(verified).toEqual({ ...userPayload, issuedAt: expect.any(Number) });
    expect(verified?.issuedAt).toBeGreaterThanOrEqual(before);
  });

  it("rejects a payload with no issuedAt", () => {
    const cookieValue = signValue(userPayload);

    expect(verifyUserSession(cookieValue)).toBeNull();
  });

  it("rejects a tampered payload", () => {
    const cookieValue = signUserSession(userPayload);
    const [, signature] = cookieValue.split(".");
    const tamperedBody = Buffer.from(JSON.stringify({ userId: "not-the-same-user" })).toString("base64url");

    expect(verifyUserSession(`${tamperedBody}.${signature}`)).toBeNull();
  });

  it("rejects a malformed cookie value", () => {
    expect(verifyUserSession("not-a-valid-cookie")).toBeNull();
    expect(verifyUserSession(undefined)).toBeNull();
  });
});
