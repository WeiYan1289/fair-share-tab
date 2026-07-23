import { beforeAll, describe, expect, it } from "vitest";
import { signSession, verifySession } from "./session";
import type { SessionPayload } from "./session";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-do-not-use-in-production";
});

const payload: SessionPayload = {
  groupId: "11111111-1111-1111-1111-111111111111",
  role: "editor",
  shareLinkId: "22222222-2222-2222-2222-222222222222",
};

describe("signSession / verifySession", () => {
  it("round-trips a valid payload", () => {
    const cookieValue = signSession(payload);

    expect(verifySession(cookieValue)).toEqual(payload);
  });

  it("rejects a tampered payload", () => {
    const cookieValue = signSession(payload);
    const [, signature] = cookieValue.split(".");
    const tamperedBody = Buffer.from(
      JSON.stringify({ ...payload, role: "editor" === payload.role ? "viewer" : "editor" }),
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
    const cookieValue = signSession(payload);
    process.env.SESSION_SECRET = "a-different-secret";

    expect(verifySession(cookieValue)).toBeNull();

    process.env.SESSION_SECRET = "test-secret-do-not-use-in-production";
  });
});
