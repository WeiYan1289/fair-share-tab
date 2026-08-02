import { describe, expect, it } from "vitest";
import { canRegenerateOrCreateLink } from "./share-link-access";

describe("canRegenerateOrCreateLink", () => {
  it("rejects a visitor replacing an existing link", () => {
    expect(canRegenerateOrCreateLink({ hasActiveLink: true, actorType: "visitor" })).toBe(false);
  });

  it("allows a visitor creating a link for a role that has none yet", () => {
    expect(canRegenerateOrCreateLink({ hasActiveLink: false, actorType: "visitor" })).toBe(true);
  });

  it("allows a registered member to replace an existing link", () => {
    expect(canRegenerateOrCreateLink({ hasActiveLink: true, actorType: "member" })).toBe(true);
  });

  it("allows a registered member to create a link for a role that has none yet", () => {
    expect(canRegenerateOrCreateLink({ hasActiveLink: false, actorType: "member" })).toBe(true);
  });
});
