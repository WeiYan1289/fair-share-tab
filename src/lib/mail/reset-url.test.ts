import { afterEach, describe, expect, it } from "vitest";
import { buildResetUrl } from "./reset-url";

const originalAppUrl = process.env.APP_URL;

afterEach(() => {
  process.env.APP_URL = originalAppUrl;
});

describe("buildResetUrl", () => {
  it("builds an absolute reset link from APP_URL", () => {
    process.env.APP_URL = "https://fairsharetab.example.com";

    expect(buildResetUrl("abc123")).toBe("https://fairsharetab.example.com/reset?token=abc123");
  });

  it("tolerates a trailing slash on APP_URL", () => {
    process.env.APP_URL = "https://fairsharetab.example.com/";

    expect(buildResetUrl("abc123")).toBe("https://fairsharetab.example.com/reset?token=abc123");
  });

  it("works for a localhost development origin", () => {
    process.env.APP_URL = "http://localhost:3000";

    expect(buildResetUrl("abc123")).toBe("http://localhost:3000/reset?token=abc123");
  });

  it("percent-encodes the token rather than interpolating it raw", () => {
    process.env.APP_URL = "https://fairsharetab.example.com";

    expect(buildResetUrl("a b&c")).toBe("https://fairsharetab.example.com/reset?token=a%20b%26c");
  });

  // Failing loudly beats falling back to the request's Host header, which
  // is attacker-controlled: a forged Host would make the server email a
  // victim a reset link pointing at the attacker's domain.
  it("throws when APP_URL is unset rather than guessing an origin", () => {
    delete process.env.APP_URL;

    expect(() => buildResetUrl("abc123")).toThrow(/APP_URL/);
  });
});
