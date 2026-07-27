import { describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import { claimVisitorGroup } from "./claim";

const GROUP_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_GROUP_ID = "99999999-9999-9999-9999-999999999999";
const MEMBER_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "33333333-3333-3333-3333-333333333333";

interface FakeMember {
  id: string;
  groupId: string;
  userId: string | null;
}

// A minimal fake standing in for Prisma.TransactionClient — only the three
// calls claimVisitorGroup actually makes. No real DB/harness exists for
// this project's test suite (only pure-module unit tests), so this keeps
// claim.ts's core logic testable without one.
function makeFakeTx(member: FakeMember | null) {
  const state = { member, membershipCreated: null as { groupId: string; userId: string; role: string } | null };

  const tx = {
    member: {
      findUnique: async () => state.member,
      update: async ({ data }: { data: { userId: string } }) => {
        if (state.member) state.member = { ...state.member, userId: data.userId };
        return state.member;
      },
    },
    groupMembership: {
      create: async ({ data }: { data: { groupId: string; userId: string; role: string } }) => {
        state.membershipCreated = data;
        return { id: "membership-1", ...data };
      },
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, state };
}

describe("claimVisitorGroup", () => {
  it("claims a valid unclaimed member: sets userId and creates a membership", async () => {
    const { tx, state } = makeFakeTx({ id: MEMBER_ID, groupId: GROUP_ID, userId: null });

    const result = await claimVisitorGroup(tx, { memberId: MEMBER_ID, groupId: GROUP_ID, userId: USER_ID });

    expect(result.claimed).toBe(true);
    expect(result.membershipId).toBe("membership-1");
    expect(state.member?.userId).toBe(USER_ID);
    expect(state.membershipCreated).toEqual({ groupId: GROUP_ID, userId: USER_ID, role: "editor" });
  });

  it("is a no-op, not an overwrite, when the member is already claimed", async () => {
    const { tx, state } = makeFakeTx({ id: MEMBER_ID, groupId: GROUP_ID, userId: "existing-owner" });

    const result = await claimVisitorGroup(tx, { memberId: MEMBER_ID, groupId: GROUP_ID, userId: USER_ID });

    expect(result.claimed).toBe(false);
    expect(state.member?.userId).toBe("existing-owner");
    expect(state.membershipCreated).toBeNull();
  });

  it("rejects a memberId/groupId pair that don't match each other", async () => {
    const { tx, state } = makeFakeTx({ id: MEMBER_ID, groupId: OTHER_GROUP_ID, userId: null });

    const result = await claimVisitorGroup(tx, { memberId: MEMBER_ID, groupId: GROUP_ID, userId: USER_ID });

    expect(result.claimed).toBe(false);
    expect(state.member?.userId).toBeNull();
  });

  it("is a no-op when the member doesn't exist", async () => {
    const { tx } = makeFakeTx(null);

    const result = await claimVisitorGroup(tx, { memberId: MEMBER_ID, groupId: GROUP_ID, userId: USER_ID });

    expect(result.claimed).toBe(false);
  });
});
