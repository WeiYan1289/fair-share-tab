import { describe, expect, it } from "vitest";
import { passwordChangedEmail, resetPasswordEmail } from "./templates";

const RESET_URL = "https://fairsharetab.example.com/reset?token=abc123";

describe("resetPasswordEmail", () => {
  const email = resetPasswordEmail({ resetUrl: RESET_URL, recipientEmail: "sarah@example.com" });

  it("puts the reset link in the HTML body", () => {
    expect(email.html).toContain(RESET_URL);
  });

  // Some clients and most screen readers use the plain-text part. A link
  // that only exists in the HTML is a locked-out user for them.
  it("puts the reset link in the plain-text body", () => {
    expect(email.text).toContain(RESET_URL);
  });

  // The visible URL is what lets a recipient confirm where the button goes
  // -- a hyperlink with a hidden target is the shape filters distrust.
  it("shows the URL as visible text, not only as a link target", () => {
    expect(email.html.replace(/<a[^>]*>|<\/a>/g, "")).toContain(RESET_URL);
  });

  it("names the account the reset was requested for", () => {
    expect(email.html).toContain("sarah@example.com");
    expect(email.text).toContain("sarah@example.com");
  });

  it("keeps the plain-text part free of markup", () => {
    expect(email.text).not.toMatch(/<[a-z][^>]*>/i);
  });

  it("has a subject", () => {
    expect(email.subject.length).toBeGreaterThan(0);
  });
});

describe("passwordChangedEmail", () => {
  const email = passwordChangedEmail({ recipientEmail: "sarah@example.com" });

  it("has a subject and both bodies", () => {
    expect(email.subject.length).toBeGreaterThan(0);
    expect(email.html.length).toBeGreaterThan(0);
    expect(email.text.length).toBeGreaterThan(0);
  });

  it("keeps the plain-text part free of markup", () => {
    expect(email.text).not.toMatch(/<[a-z][^>]*>/i);
  });

  // Someone who did not do this needs to know it happened and act.
  it("tells the recipient what to do if it wasn't them", () => {
    expect(email.text.toLowerCase()).toContain("wasn't you");
  });
});
