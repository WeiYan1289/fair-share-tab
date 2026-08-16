import { describe, expect, it } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import {
  computeGroupSettlementPreview,
  computeSettlementPreview,
  SettlementValidationError,
} from "./settlement-service";

const EVENT_ID = "e1111111-1111-1111-1111-111111111111";
const OTHER_EVENT_ID = "e2222222-2222-2222-2222-222222222222";
const ALICE = "a1111111-1111-1111-1111-111111111111";
const BOB = "b1111111-1111-1111-1111-111111111111";

interface FakeBill {
  id: string;
  eventId: string;
  payerId: string;
  totalAmount: number;
  status: "unsettled" | "settled";
  splits: { memberId: string; shareAmount: number }[];
}

interface FakeMember {
  id: string;
  name: string;
}

// A minimal fake standing in for Prisma.TransactionClient -- only the calls
// computeSettlementPreview actually makes (bill.findMany, member.findMany).
// Mirrors the pattern in src/lib/auth/claim.test.ts: this project's test
// suite has no real DB/harness, only pure-module and hand-faked-client
// unit tests. bill.updateMany is included so a test can simulate the
// confirm route's write between two preview calls.
function makeFakeTx(bills: FakeBill[], members: FakeMember[]) {
  const state = { bills: bills.map((b) => ({ ...b })) };

  const tx = {
    bill: {
      findMany: async ({ where }: { where: { id: { in: string[] }; status: string; eventId: string } }) => {
        return state.bills.filter(
          (b) =>
            where.id.in.includes(b.id) && b.status === where.status && b.eventId === where.eventId,
        );
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: { in: string[] }; status?: string };
        data: { status: "unsettled" | "settled" };
      }) => {
        let count = 0;
        state.bills = state.bills.map((b) => {
          const matches = where.id.in.includes(b.id) && (where.status === undefined || b.status === where.status);
          if (matches) count += 1;
          return matches ? { ...b, status: data.status } : b;
        });
        return { count };
      },
    },
    member: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        members.filter((m) => where.id.in.includes(m.id)),
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, state };
}

const members: FakeMember[] = [
  { id: ALICE, name: "Alice" },
  { id: BOB, name: "Bob" },
];

describe("computeSettlementPreview", () => {
  it("computes net balances and transfers for unsettled bills in the event", async () => {
    const { tx } = makeFakeTx(
      [
        {
          id: "bill-1",
          eventId: EVENT_ID,
          payerId: ALICE,
          totalAmount: 1000,
          status: "unsettled",
          splits: [
            { memberId: ALICE, shareAmount: 500 },
            { memberId: BOB, shareAmount: 500 },
          ],
        },
      ],
      members,
    );

    const preview = await computeSettlementPreview(["bill-1"], EVENT_ID, tx);

    expect(preview.billIds).toEqual(["bill-1"]);
    expect(preview.transfers).toEqual([{ fromMemberId: BOB, toMemberId: ALICE, amount: 500 }]);
    expect(preview.netBalances).toEqual(
      expect.arrayContaining([
        { memberId: ALICE, name: "Alice", net: 500 },
        { memberId: BOB, name: "Bob", net: -500 },
      ]),
    );
  });

  it("rejects a billId that belongs to a different event", async () => {
    const { tx } = makeFakeTx(
      [
        {
          id: "bill-1",
          eventId: OTHER_EVENT_ID,
          payerId: ALICE,
          totalAmount: 1000,
          status: "unsettled",
          splits: [{ memberId: ALICE, shareAmount: 1000 }],
        },
      ],
      members,
    );

    await expect(computeSettlementPreview(["bill-1"], EVENT_ID, tx)).rejects.toThrow(
      SettlementValidationError,
    );
  });

  it("rejects a billId that does not exist", async () => {
    const { tx } = makeFakeTx([], members);

    await expect(computeSettlementPreview(["missing-bill"], EVENT_ID, tx)).rejects.toThrow(
      SettlementValidationError,
    );
  });

  it("rejects a second confirm over bills the first confirm already settled", async () => {
    const { tx, state } = makeFakeTx(
      [
        {
          id: "bill-1",
          eventId: EVENT_ID,
          payerId: ALICE,
          totalAmount: 1000,
          status: "unsettled",
          splits: [
            { memberId: ALICE, shareAmount: 500 },
            { memberId: BOB, shareAmount: 500 },
          ],
        },
      ],
      members,
    );

    // First confirm: preview succeeds, then the route's guarded updateMany
    // marks the bill settled (simulated here directly).
    const firstPreview = await computeSettlementPreview(["bill-1"], EVENT_ID, tx);
    expect(firstPreview.billIds).toEqual(["bill-1"]);
    await tx.bill.updateMany({
      where: { id: { in: firstPreview.billIds }, status: "unsettled" },
      data: { status: "settled" },
    });
    expect(state.bills[0].status).toBe("settled");

    // Second confirm racing against the first: the bill is no longer
    // unsettled, so the preview itself must now reject it -- this is the
    // guard that prevents a double-settlement (two Settlement rows, two
    // sets of Transfer rows, for the same underlying bill).
    await expect(computeSettlementPreview(["bill-1"], EVENT_ID, tx)).rejects.toThrow(
      SettlementValidationError,
    );
  });

  it("deduplicates repeated billIds in the request", async () => {
    const { tx } = makeFakeTx(
      [
        {
          id: "bill-1",
          eventId: EVENT_ID,
          payerId: ALICE,
          totalAmount: 1000,
          status: "unsettled",
          splits: [{ memberId: ALICE, shareAmount: 1000 }],
        },
      ],
      members,
    );

    const preview = await computeSettlementPreview(["bill-1", "bill-1"], EVENT_ID, tx);

    expect(preview.billIds).toEqual(["bill-1"]);
  });
});

const GROUP_ID = "g1111111-1111-1111-1111-111111111111";
const OTHER_GROUP_ID = "g2222222-2222-2222-2222-222222222222";

interface FakeGroupBill {
  id: string;
  eventId: string;
  payerId: string;
  totalAmount: number;
  status: "unsettled" | "settled";
  splits: { memberId: string; shareAmount: number }[];
  event: { groupId: string; status: "active" | "archived"; currency: string };
}

function makeFakeGroupTx(bills: FakeGroupBill[], members: FakeMember[]) {
  const tx = {
    bill: {
      findMany: async ({ where }: { where: { id: { in: string[] }; status: string } }) =>
        bills.filter((b) => where.id.in.includes(b.id) && b.status === where.status),
    },
    member: {
      findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
        members.filter((m) => where.id.in.includes(m.id)),
    },
  };
  return tx as unknown as Prisma.TransactionClient;
}

function myrBill(id: string, eventId: string, overrides: Partial<FakeGroupBill> = {}): FakeGroupBill {
  return {
    id,
    eventId,
    payerId: ALICE,
    totalAmount: 1000,
    status: "unsettled",
    splits: [
      { memberId: ALICE, shareAmount: 500 },
      { memberId: BOB, shareAmount: 500 },
    ],
    event: { groupId: GROUP_ID, status: "active", currency: "MYR" },
    ...overrides,
  };
}

describe("computeGroupSettlementPreview", () => {
  it("nets unsettled bills across events in the group into one transfer set", async () => {
    const tx = makeFakeGroupTx(
      [myrBill("bill-1", "e1"), myrBill("bill-2", "e2")],
      members,
    );
    const preview = await computeGroupSettlementPreview(["bill-1", "bill-2"], GROUP_ID, tx);
    expect(preview.currency).toBe("MYR");
    expect(preview.eventIds.sort()).toEqual(["e1", "e2"]);
    expect(preview.transfers).toEqual([{ fromMemberId: BOB, toMemberId: ALICE, amount: 1000 }]);
  });

  it("rejects a bill whose event belongs to another group", async () => {
    const tx = makeFakeGroupTx(
      [myrBill("bill-1", "e1", { event: { groupId: OTHER_GROUP_ID, status: "active", currency: "MYR" } })],
      members,
    );
    await expect(computeGroupSettlementPreview(["bill-1"], GROUP_ID, tx)).rejects.toThrow(
      SettlementValidationError,
    );
  });

  it("rejects a bill whose event is archived", async () => {
    const tx = makeFakeGroupTx(
      [myrBill("bill-1", "e1", { event: { groupId: GROUP_ID, status: "archived", currency: "MYR" } })],
      members,
    );
    await expect(computeGroupSettlementPreview(["bill-1"], GROUP_ID, tx)).rejects.toThrow(
      SettlementValidationError,
    );
  });

  it("rejects bills that span more than one currency", async () => {
    const tx = makeFakeGroupTx(
      [
        myrBill("bill-1", "e1"),
        myrBill("bill-2", "e2", { event: { groupId: GROUP_ID, status: "active", currency: "JPY" } }),
      ],
      members,
    );
    await expect(computeGroupSettlementPreview(["bill-1", "bill-2"], GROUP_ID, tx)).rejects.toThrow(
      SettlementValidationError,
    );
  });

  it("rejects a billId that is missing or already settled", async () => {
    const tx = makeFakeGroupTx([myrBill("bill-1", "e1", { status: "settled" })], members);
    await expect(computeGroupSettlementPreview(["bill-1"], GROUP_ID, tx)).rejects.toThrow(
      SettlementValidationError,
    );
  });
});
