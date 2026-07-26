import { beforeAll, describe, expect, it } from "vitest";
import { signVisitorCapCookie, verifyVisitorCapCookie } from "./visitor-cap";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-do-not-use-in-production";
});

const payload = {
  groupId: "11111111-1111-1111-1111-111111111111",
  memberId: "22222222-2222-2222-2222-222222222222",
};

describe("signVisitorCapCookie / verifyVisitorCapCookie", () => {
  it("round-trips a valid payload", () => {
    const cookieValue = signVisitorCapCookie(payload);

    expect(verifyVisitorCapCookie(cookieValue)).toEqual(payload);
  });

  it("rejects a tampered memberId", () => {
    const cookieValue = signVisitorCapCookie(payload);
    const [, signature] = cookieValue.split(".");
    const tamperedBody = Buffer.from(
      JSON.stringify({ ...payload, memberId: "33333333-3333-3333-3333-333333333333" }),
    ).toString("base64url");

    expect(verifyVisitorCapCookie(`${tamperedBody}.${signature}`)).toBeNull();
  });

  it("rejects a malformed cookie value", () => {
    expect(verifyVisitorCapCookie("not-a-valid-cookie")).toBeNull();
    expect(verifyVisitorCapCookie(undefined)).toBeNull();
    expect(verifyVisitorCapCookie(null)).toBeNull();
  });

  it("rejects a payload missing groupId or memberId", () => {
    const cookieValue = signVisitorCapCookie({ groupId: payload.groupId } as never);

    expect(verifyVisitorCapCookie(cookieValue)).toBeNull();
  });
});
