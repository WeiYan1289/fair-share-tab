import { describe, expect, it } from "vitest";
import { getGroupOwner, isRestoreOnlyGroupPatch, type GroupOwnerClient } from "./account";

const GROUP_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_GROUP_ID = "99999999-9999-9999-9999-999999999999";
const OWNER_USER_ID = "22222222-2222-2222-2222-222222222222";

// A minimal fake standing in for the two Prisma model delegates
// getGroupOwner actually calls — same style as claim.test.ts's fake
// Prisma.TransactionClient, since this repo has no DB test harness.
function makeFakeClient(params: {
  membership: { userId: string } | null;
  member: { name: string } | null;
}): GroupOwnerClient {
  return {
    groupMembership: {
      findFirst: async (args) => {
        if (args.where.groupId !== GROUP_ID) return null;
        return params.membership;
      },
    },
    member: {
      findFirst: async (args) => {
        if (args.where.groupId !== GROUP_ID || args.where.userId !== OWNER_USER_ID) return null;
        return params.member;
      },
    },
  };
}

describe("getGroupOwner", () => {
  it("returns the owner's userId and member name for an owned group", async () => {
    const client = makeFakeClient({
      membership: { userId: OWNER_USER_ID },
      member: { name: "Alice" },
    });

    const owner = await getGroupOwner(GROUP_ID, client);

    expect(owner).toEqual({ userId: OWNER_USER_ID, memberName: "Alice" });
  });

  it("returns null for an unowned group (no GroupMembership row)", async () => {
    const client = makeFakeClient({ membership: null, member: { name: "Alice" } });

    const owner = await getGroupOwner(GROUP_ID, client);

    expect(owner).toBeNull();
  });

  it("returns a memberName of null when the membership exists but no matching member row does", async () => {
    const client = makeFakeClient({ membership: { userId: OWNER_USER_ID }, member: null });

    const owner = await getGroupOwner(GROUP_ID, client);

    expect(owner).toEqual({ userId: OWNER_USER_ID, memberName: null });
  });

  it("does not find a membership belonging to a different group", async () => {
    const client = makeFakeClient({ membership: { userId: OWNER_USER_ID }, member: { name: "Alice" } });

    const owner = await getGroupOwner(OTHER_GROUP_ID, client);

    expect(owner).toBeNull();
  });
});

// isRestoreOnlyGroupPatch is the archived-groups PATCH route's one
// exception to sealing: a payload that ONLY restores status to "active"
// is let through against an archived group, everything else 409s. It is a
// pure function of updateGroupSchema's shape (src/lib/validation/group.ts)
// -- if a field is ever added to that schema without being added here, the
// seal silently reopens for that field whenever it rides along with
// status:"active" on an archived group. These cases must be revisited any
// time updateGroupSchema gains a field. Mirrors isRestoreOnlyEventPatch's
// test coverage in events.test.ts.
describe("isRestoreOnlyGroupPatch", () => {
  it("is true for status:active alone", () => {
    expect(isRestoreOnlyGroupPatch({ status: "active" })).toBe(true);
  });

  it("is false when a name rides along with status:active", () => {
    expect(isRestoreOnlyGroupPatch({ status: "active", name: "x" })).toBe(false);
  });

  it("is false for status:archived", () => {
    expect(isRestoreOnlyGroupPatch({ status: "archived" })).toBe(false);
  });

  it("is false for a rename with no status field at all", () => {
    expect(isRestoreOnlyGroupPatch({ name: "x" })).toBe(false);
  });
});
