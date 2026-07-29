import { describe, expect, it } from "vitest";
import { assertSameOrigin, CsrfError } from "./assert-same-origin";

const URL_STR = "https://fairsharetab.example/api/groups";

function request(headers: Record<string, string>): Request {
  return new Request(URL_STR, { method: "POST", headers });
}

describe("assertSameOrigin", () => {
  it("allows Sec-Fetch-Site: same-origin", () => {
    expect(() => assertSameOrigin(request({ "sec-fetch-site": "same-origin" }))).not.toThrow();
  });

  it("allows Sec-Fetch-Site: none (direct navigation, no initiating origin)", () => {
    expect(() => assertSameOrigin(request({ "sec-fetch-site": "none" }))).not.toThrow();
  });

  it("rejects Sec-Fetch-Site: cross-site", () => {
    expect(() => assertSameOrigin(request({ "sec-fetch-site": "cross-site" }))).toThrow(CsrfError);
  });

  it("rejects Sec-Fetch-Site: same-site (a different subdomain is still not this origin)", () => {
    expect(() => assertSameOrigin(request({ "sec-fetch-site": "same-site" }))).toThrow(CsrfError);
  });

  it("falls back to a matching Origin header when Sec-Fetch-Site is absent", () => {
    expect(() =>
      assertSameOrigin(request({ origin: "https://fairsharetab.example" })),
    ).not.toThrow();
  });

  it("rejects a mismatched Origin header when Sec-Fetch-Site is absent", () => {
    expect(() => assertSameOrigin(request({ origin: "https://evil.example" }))).toThrow(CsrfError);
  });

  it("rejects when neither header is present -- fail closed, not open", () => {
    expect(() => assertSameOrigin(request({}))).toThrow(CsrfError);
  });

  it("CsrfError carries a 403 status for the route handler to return", () => {
    try {
      assertSameOrigin(request({}));
      throw new Error("expected assertSameOrigin to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(CsrfError);
      expect((error as CsrfError).status).toBe(403);
    }
  });
});
