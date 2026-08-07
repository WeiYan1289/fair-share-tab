import { describe, expect, it } from "vitest";
import { isRestoreOnlyEventPatch } from "./events";

// isRestoreOnlyEventPatch is the archived-events PATCH route's one
// exception to sealing: a payload that ONLY restores status to "active"
// is let through against an archived event, everything else 409s. It is a
// pure function of updateEventSchema's shape (src/lib/validation/event.ts)
// -- if a field is ever added to that schema without being added here, the
// seal silently reopens for that field whenever it rides along with
// status:"active" on an archived event. These cases must be revisited any
// time updateEventSchema gains a field.
describe("isRestoreOnlyEventPatch", () => {
  it("is true for status:active alone", () => {
    expect(isRestoreOnlyEventPatch({ status: "active" })).toBe(true);
  });

  it("is false when a name rides along with status:active", () => {
    expect(isRestoreOnlyEventPatch({ status: "active", name: "x" })).toBe(false);
  });

  it("is false when a startDate rides along with status:active", () => {
    expect(isRestoreOnlyEventPatch({ status: "active", startDate: "2026-01-01" })).toBe(false);
  });

  it("is false when an endDate rides along with status:active", () => {
    expect(isRestoreOnlyEventPatch({ status: "active", endDate: "2026-01-31" })).toBe(false);
  });

  it("is false for status:archived", () => {
    expect(isRestoreOnlyEventPatch({ status: "archived" })).toBe(false);
  });

  it("is false for a rename with no status field at all", () => {
    expect(isRestoreOnlyEventPatch({ name: "x" })).toBe(false);
  });
});
