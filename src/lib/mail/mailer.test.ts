import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConsoleMailer, getMailer, ResendMailer, setMailerForTesting } from "./mailer";

const original = {
  MAILER: process.env.MAILER,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  EMAIL_FROM: process.env.EMAIL_FROM,
  NODE_ENV: process.env.NODE_ENV,
};

function setNodeEnv(value: string) {
  // NODE_ENV is readonly in the Node types; the assignment is what the
  // production-guard test needs to exercise.
  (process.env as Record<string, string>).NODE_ENV = value;
}

beforeEach(() => {
  setMailerForTesting(null);
});

afterEach(() => {
  setMailerForTesting(null);
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else (process.env as Record<string, string>)[key] = value;
  }
});

describe("getMailer", () => {
  it("throws when MAILER is unset rather than guessing a transport", () => {
    delete process.env.MAILER;

    expect(() => getMailer()).toThrow(/MAILER/);
  });

  it("throws on an unrecognized MAILER value", () => {
    process.env.MAILER = "sendmail";

    expect(() => getMailer()).toThrow(/MAILER/);
  });

  it("returns the console transport outside production", () => {
    process.env.MAILER = "console";
    setNodeEnv("development");

    expect(getMailer()).toBeInstanceOf(ConsoleMailer);
  });

  // Silently logging mail in production would look healthy while locking
  // every user out of account recovery.
  it("refuses the console transport in production", () => {
    process.env.MAILER = "console";
    setNodeEnv("production");

    expect(() => getMailer()).toThrow(/production/);
  });

  it("returns the Resend transport when configured", () => {
    process.env.MAILER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "noreply@example.com";

    expect(getMailer()).toBeInstanceOf(ResendMailer);
  });

  it("throws when the Resend transport has no API key", () => {
    process.env.MAILER = "resend";
    delete process.env.RESEND_API_KEY;
    process.env.EMAIL_FROM = "noreply@example.com";

    expect(() => getMailer()).toThrow(/RESEND_API_KEY/);
  });

  it("throws when the Resend transport has no sender address", () => {
    process.env.MAILER = "resend";
    process.env.RESEND_API_KEY = "re_test_key";
    delete process.env.EMAIL_FROM;

    expect(() => getMailer()).toThrow(/EMAIL_FROM/);
  });
});

describe("ResendMailer", () => {
  it("posts the message to Resend with the configured sender and key", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fakeFetch = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ id: "sent" }), { status: 200 });
    };

    const mailer = new ResendMailer({
      apiKey: "re_test_key",
      from: "noreply@example.com",
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });
    await mailer.send({ to: "sarah@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.resend.com/emails");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_key");
    expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
      from: "noreply@example.com",
      to: "sarah@example.com",
      subject: "Hi",
    });
  });

  // The caller (the after() block in /api/auth/forgot) logs this. Swallowing
  // it there would make an unverified domain or a revoked key look like a
  // successful send.
  it("throws when Resend rejects the send", async () => {
    const fakeFetch = async () =>
      new Response(JSON.stringify({ message: "domain is not verified" }), { status: 403 });

    const mailer = new ResendMailer({
      apiKey: "re_test_key",
      from: "noreply@unverified.example",
      fetchImpl: fakeFetch as unknown as typeof fetch,
    });

    await expect(
      mailer.send({ to: "sarah@example.com", subject: "Hi", html: "<p>Hi</p>", text: "Hi" }),
    ).rejects.toThrow(/domain is not verified/);
  });
});
