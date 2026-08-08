import { describe, expect, it } from "vitest";
import { isReceiptUrl } from "./url";

describe("isReceiptUrl", () => {
  it("accepts an https URL on a Vercel Blob public host", () => {
    expect(isReceiptUrl("https://abc123.public.blob.vercel-storage.com/receipts/g/x.jpg")).toBe(
      true,
    );
  });

  it("rejects http, even on the right host", () => {
    expect(isReceiptUrl("http://abc123.public.blob.vercel-storage.com/receipts/g/x.jpg")).toBe(
      false,
    );
  });

  it("rejects a foreign host", () => {
    expect(isReceiptUrl("https://evil.example.com/receipt.jpg")).toBe(false);
  });

  // The suffix must be matched as a whole label, or an attacker-controlled
  // domain that merely ends in the right characters would pass.
  it("rejects a lookalike host that only ends with the string", () => {
    expect(isReceiptUrl("https://public.blob.vercel-storage.com.evil.com/x.jpg")).toBe(false);
    expect(isReceiptUrl("https://notpublic.blob.vercel-storage.com/x.jpg")).toBe(false);
  });

  it("rejects the bare suffix with no store label", () => {
    expect(isReceiptUrl("https://public.blob.vercel-storage.com/x.jpg")).toBe(false);
  });

  it("rejects unparseable input", () => {
    expect(isReceiptUrl("not a url")).toBe(false);
    expect(isReceiptUrl("")).toBe(false);
  });
});
