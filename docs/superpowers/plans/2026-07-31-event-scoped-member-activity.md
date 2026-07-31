# Event-Scoped Member Activity + Group-Wide Member Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the group's `/events` page a lightweight member list (avatar + name, no balance figure) that can view a member's cross-event expenses and also rename/deactivate them, and replace the event dashboard's "View expenses" chip action with a screen scoped to that one event only — with wording and interaction patterns that keep the two entry points from ever being confused.

**Architecture:** No new pure module beyond one small extraction. The single-event view reuses `computeMemberEventExpense` (already pure, already tested) for spend/lines, and a new pure helper `computeMemberEventBalance` (extracted out of `getMemberBalance`'s existing inline logic) for net/transfers — both composed in a new thin Prisma wrapper, matching the existing split between `src/lib/expenses/aggregate.ts` (pure) and `src/lib/expenses/index.ts` (DB-touching). Rather than building a second, bespoke "lightweight member list" component, the existing `MemberChip` is generalized to work in two modes via an optional `eventId`: with an event, it behaves as it does today (balance shown, action labeled "View activity", opens the new single-event screen); without one, it drops the balance line and labels the action "View expenses" instead, opening the existing cross-event screen. One component, one place where the label/href pairing lives, used on both the event dashboard and the events list.

**Tech Stack:** Next.js 15 App Router Server Components, Prisma, TypeScript, Tailwind, Vitest.

## Global Constraints

- Money is integers in the smallest currency unit; never float, never decimal-as-string (CLAUDE.md rule 1).
- No per-viewer identity, no "you" anywhere — every screen renders identically for anyone with the link (CLAUDE.md rule 5).
- All DB access goes through server code / Prisma; no client-side data fetching of app data (CLAUDE.md rule 7).
- Members are never deleted, only deactivated (CLAUDE.md rule 4) — this plan adds a second place to trigger that, not a new deletion path.
- `requireSession()` with no role requirement on member-detail routes — viewers see the same thing as editors (matches the existing `expenses`/`balance` routes). Rename/Deactivate stay editor-only server-side (`PATCH /api/members/[id]`, unchanged) — the menu already only shows those items to editors; this plan doesn't touch that authorization.
- Settlement/expense math stays in pure modules with no framework or DB imports (`src/lib/expenses/aggregate.ts`, `src/lib/settlement/*`); DB-touching wrappers stay thin and call into them.
- Naming must disambiguate the two member-detail screens without reusing the same word for both scopes: the cross-event screens keep **"expenses" / "balance"**; the single-event screen and its entry point are called **"activity"** throughout.

---

## Context: current behavior being changed

- `/g/[groupId]/events` ([EventsListView.tsx](src/components/events/EventsListView.tsx)) currently shows no member list at all.
- `/g/[groupId]/events/[eventId]` ([EventDashboard.tsx:130](src/components/events/EventDashboard.tsx:130)) renders `MemberChip` for each event member. Its "View expenses" menu item ([MemberChip.tsx:69](src/components/members/MemberChip.tsx:69), `expensesHref`) links to `/g/${groupId}/members/${member.id}/expenses?event=${eventId}` — the **cross-event** `MemberExpenseView`, just auto-scrolled/expanded to that one event via `initialEventId`. This is the exact confusion the user flagged: from an event-specific page, the destination screen shows every other event too.
- `MemberExpenseView` ([MemberExpenseView.tsx](src/components/members/MemberExpenseView.tsx)) and `MemberBalanceView` ([MemberBalanceView.tsx](src/components/members/MemberBalanceView.tsx)) are the Screen Spec P4-06/P4-07 tabs — always cross-event, backed by `getMemberExpenses`/`getMemberBalance` in [src/lib/expenses/index.ts](src/lib/expenses/index.ts).
- `DeactivateConfirmModal` ([DeactivateConfirmModal.tsx](src/components/members/DeactivateConfirmModal.tsx)) and the rename PATCH flow are currently only reachable from the event dashboard.

After this plan: the cross-event screens become the destination of a **new** entry point on `/events` (via a generalized `MemberChip`, with full Rename/Deactivate parity), and the event dashboard's chip instead opens a **new**, single-event screen.

---

## File Structure

- `src/lib/expenses/aggregate.ts` — **modify**: add pure `computeMemberEventBalance`.
- `src/lib/expenses/aggregate.test.ts` — **modify**: tests for the new pure function.
- `src/lib/expenses/index.ts` — **modify**: refactor `getMemberBalance` to use the new pure helper; add `getMemberEventActivity`.
- `src/components/members/MemberExpenseView.tsx` — **modify**: drop event-scoping (`initialEventId`); clarify subtitle wording.
- `src/components/members/MemberBalanceView.tsx` — **modify**: drop event-scoping (`initialEventId`); clarify subtitle wording; use `MemberTransferRow`.
- `src/components/members/MemberTransferRow.tsx` — **create**: shared transfer-row markup, extracted out of `MemberBalanceView` so the new activity screen can reuse it instead of duplicating markup.
- `src/components/members/MemberEventActivityView.tsx` — **create**: the new single-event screen.
- `src/app/g/[groupId]/events/[eventId]/members/[memberId]/page.tsx` — **create**: its route.
- `src/components/members/MemberChip.tsx` — **modify**: `eventId`/`currency` become optional; label/href/balance depend on whether an event context is present.
- `src/lib/members.ts` — **create**: `listGroupMembers(groupId)`, the lightweight query the `/events` page needs.
- `src/components/events/EventsListView.tsx` — **modify**: render the member list (via `MemberChip`, no `eventId`) with rename/deactivate wiring.
- `src/app/g/[groupId]/events/page.tsx` — **modify**: fetch and pass `members`.
- `src/app/g/[groupId]/members/[memberId]/expenses/page.tsx` — **modify**: drop `?event=` handling.
- `src/app/g/[groupId]/members/[memberId]/balance/page.tsx` — **modify**: drop `?event=` handling.

---

### Task 1: Pure `computeMemberEventBalance` helper + refactor its one caller

**Files:**
- Modify: `src/lib/expenses/aggregate.ts`
- Modify: `src/lib/expenses/aggregate.test.ts`
- Modify: `src/lib/expenses/index.ts:135-181` (`getMemberBalance`)

**Interfaces:**
- Consumes: `computeNetBalances`, `simplifyDebts` from `@/lib/settlement` (existing, pure); `Transfer`, `BillForNetting` types from `@/lib/settlement/types`.
- Produces: `computeMemberEventBalance(memberId: string, unsettledBills: BillForNetting[]): MemberEventBalance`, where `MemberEventBalance = { net: number; transfers: { otherMemberId: string; direction: "pays" | "receives"; amount: number }[] }`. Task 2 (`getMemberEventActivity`) and the refactored `getMemberBalance` both call this.

This is the one piece of genuinely new math: today it lives inline inside `getMemberBalance`'s per-event loop ([index.ts:150-177](src/lib/expenses/index.ts:150)). Pulling it into `aggregate.ts` makes it unit-testable and lets the new single-event wrapper (Task 2) reuse it instead of re-deriving net/transfers a second way.

- [ ] **Step 1: Write the failing tests**

Add to the bottom of `src/lib/expenses/aggregate.test.ts` (reuse the file's existing `ALICE`/`BOB`/`CAROL` constants — note `computeMemberEventBalance` takes `BillForNetting[]`, i.e. just `{ payerId, totalAmount, splits }`, not the full `ExpenseBill` shape, so build plain objects rather than calling the file's `bill()` helper):

```ts
import { computeMemberEventBalance, computeMemberEventExpense, type ExpenseBill } from "./aggregate";

describe("computeMemberEventBalance", () => {
  it("returns zero net and no transfers when nothing is unsettled", () => {
    const result = computeMemberEventBalance(ALICE, []);
    expect(result).toEqual({ net: 0, transfers: [] });
  });

  it("returns zero net and no transfers for a member whose net is exactly zero", () => {
    // Alice paid 1000 split evenly 500/500 with Bob and also owes Bob a
    // separate 500 -- nets to exactly zero for Alice.
    const bills = [
      { payerId: ALICE, totalAmount: 1000, splits: [{ memberId: ALICE, shareAmount: 500 }, { memberId: BOB, shareAmount: 500 }] },
      { payerId: BOB, totalAmount: 500, splits: [{ memberId: ALICE, shareAmount: 500 }] },
    ];
    const result = computeMemberEventBalance(ALICE, bills);
    expect(result).toEqual({ net: 0, transfers: [] });
  });

  it("computes a simple 1-to-1 debt as a single transfer", () => {
    const bills = [
      { payerId: ALICE, totalAmount: 1000, splits: [{ memberId: ALICE, shareAmount: 500 }, { memberId: BOB, shareAmount: 500 }] },
    ];
    const result = computeMemberEventBalance(BOB, bills);
    expect(result.net).toBe(-500);
    expect(result.transfers).toEqual([{ otherMemberId: ALICE, direction: "pays", amount: 500 }]);
  });

  it("labels the other side as 'receives' when this member is the creditor", () => {
    const bills = [
      { payerId: ALICE, totalAmount: 1000, splits: [{ memberId: ALICE, shareAmount: 500 }, { memberId: BOB, shareAmount: 500 }] },
    ];
    const result = computeMemberEventBalance(ALICE, bills);
    expect(result.net).toBe(500);
    expect(result.transfers).toEqual([{ otherMemberId: BOB, direction: "receives", amount: 500 }]);
  });

  it("filters simplified transfers down to only the ones touching this member", () => {
    // Carol pays for everyone; both Alice and Bob owe Carol. Asking for
    // Alice's balance must not include the Bob->Carol transfer.
    const bills = [
      {
        payerId: CAROL,
        totalAmount: 900,
        splits: [
          { memberId: ALICE, shareAmount: 300 },
          { memberId: BOB, shareAmount: 300 },
          { memberId: CAROL, shareAmount: 300 },
        ],
      },
    ];
    const result = computeMemberEventBalance(ALICE, bills);
    expect(result.net).toBe(-300);
    expect(result.transfers).toEqual([{ otherMemberId: CAROL, direction: "pays", amount: 300 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/expenses/aggregate.test.ts`
Expected: FAIL — `computeMemberEventBalance` is not exported from `./aggregate`.

- [ ] **Step 3: Implement the pure function**

In `src/lib/expenses/aggregate.ts`, add the import and function (after the existing `computeMemberEventExpense`):

```ts
import { computeNetBalances, simplifyDebts } from "@/lib/settlement";
import type { BillForNetting } from "@/lib/settlement/types";
```

```ts
export interface MemberEventBalanceTransfer {
  otherMemberId: string;
  direction: "pays" | "receives";
  amount: number;
}

export interface MemberEventBalance {
  net: number;
  transfers: MemberEventBalanceTransfer[];
}

/**
 * Nets and simplifies one event's *unsettled* bills (the caller filters by
 * status -- this function has no notion of it, same convention as
 * computeMemberEventExpense), then keeps only the transfers that touch
 * `memberId`. Shared by getMemberBalance (loops this over every unsettled
 * event a member is in) and getMemberEventActivity (calls it once, for a
 * single event) so the two screens can never silently disagree on the math.
 */
export function computeMemberEventBalance(memberId: string, unsettledBills: BillForNetting[]): MemberEventBalance {
  const nets = computeNetBalances(unsettledBills);
  const net = nets.get(memberId) ?? 0;
  if (net === 0) return { net: 0, transfers: [] };

  const transfers = simplifyDebts(nets)
    .filter((t) => t.fromMemberId === memberId || t.toMemberId === memberId)
    .map((t): MemberEventBalanceTransfer => {
      const isPayer = t.fromMemberId === memberId;
      return {
        otherMemberId: isPayer ? t.toMemberId : t.fromMemberId,
        direction: isPayer ? "pays" : "receives",
        amount: t.amount,
      };
    });

  return { net, transfers };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/expenses/aggregate.test.ts`
Expected: PASS, all cases including the pre-existing `computeMemberEventExpense` suite.

- [ ] **Step 5: Refactor `getMemberBalance` to use the new helper**

In `src/lib/expenses/index.ts`, two import changes are needed first:

- Delete the line `import { computeNetBalances, simplifyDebts } from "@/lib/settlement";` — after this refactor nothing in `index.ts` calls them directly anymore (they're used inside `computeMemberEventBalance` in `aggregate.ts` instead). Leaving the import in place would fail the build with an unused-import error.
- Change `import { computeMemberEventExpense, type MemberBillLine } from "./aggregate";` to:
  ```ts
  import {
    computeMemberEventBalance,
    computeMemberEventExpense,
    type MemberBillLine,
    type MemberEventBalanceTransfer,
  } from "./aggregate";
  ```
  (`MemberEventBalanceTransfer` isn't used yet in this task — it's there for Task 2, which shares this same import line rather than adding a second one.)

Now replace the inline net/transfer block inside the `for (const event of events)` loop of `getMemberBalance` ([index.ts:150-177](src/lib/expenses/index.ts:150)). Current code computes `nets`/`net`/`transfers` inline; replace with:

```ts
  for (const event of events) {
    if (event.bills.length === 0) continue;

    const { net, transfers } = computeMemberEventBalance(
      memberId,
      event.bills.map((bill) => ({
        payerId: bill.payerId,
        totalAmount: bill.totalAmount,
        splits: bill.splits.map((split) => ({ memberId: split.memberId, shareAmount: split.shareAmount })),
      })),
    );
    if (net === 0) continue;

    const nameById = new Map(event.eventMembers.map(({ member: m }) => [m.id, m.name]));
    const namedTransfers: MemberBalanceTransfer[] = transfers.map((t) => ({
      ...t,
      otherName: nameById.get(t.otherMemberId) ?? "",
    }));

    results.push({ id: event.id, name: event.name, currency: event.currency, net, transfers: namedTransfers });
  }
```

Keep `MemberBalanceTransfer`/`MemberBalanceEvent`/`MemberBalance` interfaces as they are — only the computation inside the loop changes, not the function's return shape.

- [ ] **Step 6: Run the full test suite to confirm nothing broke**

Run: `npm test`
Expected: All suites pass (this refactor changes no public behavior of `getMemberBalance`, only where the math lives).

- [ ] **Step 7: Commit**

```bash
git add src/lib/expenses/aggregate.ts src/lib/expenses/aggregate.test.ts src/lib/expenses/index.ts
git commit -m "refactor: extract computeMemberEventBalance as a shared pure helper"
```

---

### Task 2: `getMemberEventActivity` — single-event Prisma wrapper

**Files:**
- Modify: `src/lib/expenses/index.ts`

**Interfaces:**
- Consumes: `computeMemberEventExpense` (existing), `computeMemberEventBalance` (Task 1), `MemberExpenseBillLine` (existing interface in this file), `MemberEventBalanceTransfer` (Task 1, already imported at the top of this file as of Task 1 Step 5).
- Produces: `getMemberEventActivity(memberId: string, eventId: string, groupId: string): Promise<MemberEventActivity | null>`, where:
  ```ts
  export interface MemberEventActivity {
    member: { id: string; name: string; avatarColor: string; isActive: boolean };
    event: { id: string; name: string; currency: string };
    share: number;
    paid: number;
    net: number;
    lines: MemberExpenseBillLine[];
    transfers: (MemberEventBalanceTransfer & { otherName: string })[];
  }
  ```
  Task 5 (route) consumes this shape directly.

- [ ] **Step 1: Implement the wrapper**

Add to `src/lib/expenses/index.ts`, below `getMemberBalance`:

```ts
export interface MemberEventActivity {
  member: { id: string; name: string; avatarColor: string; isActive: boolean };
  event: { id: string; name: string; currency: string };
  share: number;
  paid: number;
  net: number;
  lines: MemberExpenseBillLine[];
  transfers: (MemberEventBalanceTransfer & { otherName: string })[];
}

/**
 * Everything about one member's involvement in exactly one event -- their
 * bills, their share/paid totals (all bills, settled and unsettled, same
 * spend-history semantics as computeMemberEventExpense), and their net
 * balance and settlement transfers for this event only (unsettled bills
 * only, same as getMemberBalance). This is the destination for the event
 * dashboard's member chip, deliberately scoped to one event so it never
 * shows anything from the member's other trips -- that's what
 * getMemberExpenses/getMemberBalance are for.
 */
export async function getMemberEventActivity(
  memberId: string,
  eventId: string,
  groupId: string,
): Promise<MemberEventActivity | null> {
  const member = await loadMember(memberId, groupId);
  if (!member) return null;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      bills: { include: { splits: true, payer: { select: { name: true } } } },
      eventMembers: { include: { member: { select: { id: true, name: true } } } },
    },
  });
  if (!event || event.groupId !== groupId) return null;

  const toExpenseBill = (bill: (typeof event.bills)[number]) => ({
    billId: bill.id,
    title: bill.title,
    totalAmount: bill.totalAmount,
    payerId: bill.payerId,
    createdAt: bill.createdAt,
    splits: bill.splits.map((s) => ({ memberId: s.memberId, shareAmount: s.shareAmount })),
  });

  const expense = computeMemberEventExpense(memberId, event.bills.map(toExpenseBill));
  const payerNameByBillId = new Map(event.bills.map((b) => [b.id, b.payer.name]));

  const unsettledBills = event.bills.filter((b) => b.status === "unsettled").map(toExpenseBill);
  const { net, transfers } = computeMemberEventBalance(memberId, unsettledBills);
  const nameById = new Map(event.eventMembers.map(({ member: m }) => [m.id, m.name]));

  return {
    member,
    event: { id: event.id, name: event.name, currency: event.currency },
    share: expense.share,
    paid: expense.paid,
    net,
    lines: expense.lines.map((line) => ({ ...line, payerName: payerNameByBillId.get(line.billId) ?? "" })),
    transfers: transfers.map((t) => ({ ...t, otherName: nameById.get(t.otherMemberId) ?? "" })),
  };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. `member` here is the raw `loadMember` result (`{ id, name, avatarColor, isActive, groupId }`) — it structurally satisfies the narrower `{ id, name, avatarColor, isActive }` the interface declares, same as `getMemberBalance`'s existing use of `loadMember` elsewhere in this file, so no extra mapping is needed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/expenses/index.ts
git commit -m "feat: add getMemberEventActivity for single-event member detail"
```

---

### Task 3: Simplify the cross-event screens — drop event-scoping, clarify wording

**Files:**
- Modify: `src/components/members/MemberExpenseView.tsx`
- Modify: `src/components/members/MemberBalanceView.tsx`
- Modify: `src/app/g/[groupId]/members/[memberId]/expenses/page.tsx`
- Modify: `src/app/g/[groupId]/members/[memberId]/balance/page.tsx`

These two screens are becoming exclusively the destination of the group-wide member list (Task 7), which has no event context at all — so the `?event=` deep-link/auto-expand behavior is now dead code once Task 6 repoints the event dashboard's chip elsewhere. Removing it also removes the one thing that made these screens ambiguous with the new single-event screen (Task 5).

- [ ] **Step 1: `MemberExpenseView` — drop `initialEventId`, fix `backHref`, clarify subtitle**

In `src/components/members/MemberExpenseView.tsx`:

Remove `initialEventId: string | null;` from `MemberExpenseViewProps` ([:41](src/components/members/MemberExpenseView.tsx:41)) and from the destructured props ([:59](src/components/members/MemberExpenseView.tsx:59)).

Change the `expandedId` state initializer ([:64](src/components/members/MemberExpenseView.tsx:64)) from `useState<string | null>(initialEventId)` to `useState<string | null>(null)`.

Replace the `backHref` line ([:79](src/components/members/MemberExpenseView.tsx:79)):

```tsx
  const backHref = `/g/${groupId}/events`;
```

Update the subtitle text ([:97-100](src/components/members/MemberExpenseView.tsx:97)) to make the cross-event scope explicit:

```tsx
              <p className="mt-0.5 text-[12.5px] text-muted sm:text-[13px] dark:text-dark-muted">
                {member.name}&rsquo;s share of every bill across every event in {groupName}
                {events.length > 0 ? " — including trips that are already settled." : "."}
              </p>
```

- [ ] **Step 2: `MemberBalanceView` — same cleanup**

In `src/components/members/MemberBalanceView.tsx`:

Remove `initialEventId: string | null;` from `MemberBalanceViewProps` ([:29](src/components/members/MemberBalanceView.tsx:29)) and the destructured prop ([:42](src/components/members/MemberBalanceView.tsx:42)).

Replace the `backHref` line ([:44](src/components/members/MemberBalanceView.tsx:44)):

```tsx
  const backHref = `/g/${groupId}/events`;
```

Update the subtitle ([:62-65](src/components/members/MemberBalanceView.tsx:62)):

```tsx
              <p className="mt-0.5 text-[12.5px] text-muted sm:text-[13px] dark:text-dark-muted">
                What&rsquo;s still outstanding for {member.name} across every event in {groupName}.
                Settled trips don&rsquo;t appear here.
              </p>
```

- [ ] **Step 3: Drop `?event=` in both page routes**

In `src/app/g/[groupId]/members/[memberId]/expenses/page.tsx`: remove `event?: string;` from the `searchParams` type ([:14](src/app/g/[groupId]/members/[memberId]/expenses/page.tsx:14)), remove `const { event, currency } = await searchParams;` → `const { currency } = await searchParams;` ([:17](src/app/g/[groupId]/members/[memberId]/expenses/page.tsx:17)), and remove the `initialEventId={event ?? null}` prop ([:48](src/app/g/[groupId]/members/[memberId]/expenses/page.tsx:48)).

In `src/app/g/[groupId]/members/[memberId]/balance/page.tsx`: remove `searchParams` entirely (it only ever carried `event`) — delete the `searchParams` parameter ([:11-14](src/app/g/[groupId]/members/[memberId]/balance/page.tsx:11)) and the `const { event } = await searchParams;` line ([:17](src/app/g/[groupId]/members/[memberId]/balance/page.tsx:17)), and remove `initialEventId={event ?? null}` ([:46](src/app/g/[groupId]/members/[memberId]/balance/page.tsx:46)).

- [ ] **Step 4: Type-check and run tests**

Run: `npx tsc --noEmit && npm test`
Expected: no errors, all suites pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/members/MemberExpenseView.tsx src/components/members/MemberBalanceView.tsx \
  src/app/g/\[groupId\]/members/\[memberId\]/expenses/page.tsx src/app/g/\[groupId\]/members/\[memberId\]/balance/page.tsx
git commit -m "refactor: drop event-scoping from the cross-event member screens"
```

---

### Task 4: `MemberTransferRow` — extract shared transfer-row markup

**Files:**
- Create: `src/components/members/MemberTransferRow.tsx`
- Modify: `src/components/members/MemberBalanceView.tsx`

**Interfaces:**
- Produces: `<MemberTransferRow memberName otherName direction amount currency />`. Consumed here by `MemberBalanceView` and in Task 5 by `MemberEventActivityView` — both need the identical "X pays Y — amount" row.

- [ ] **Step 1: Create the component**

```tsx
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

interface MemberTransferRowProps {
  memberName: string;
  otherName: string;
  direction: "pays" | "receives";
  amount: number;
  currency: string;
}

// One settlement transfer touching a single member, phrased "{payer} pays
// {payee}" so it reads the same whichever end you're looking from -- no
// "you" (CLAUDE.md rule 5). Shared by the cross-event Balance tab and the
// single-event activity screen so a transfer row never looks different
// depending on which screen it's rendered from.
export function MemberTransferRow({ memberName, otherName, direction, amount, currency }: MemberTransferRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <p className="text-[13.5px] text-ink dark:text-dark-text">
        {direction === "pays" ? (
          <>
            <span className="font-bold">{memberName}</span> pays {otherName}
          </>
        ) : (
          <>
            <span className="font-bold">{otherName}</span> pays {memberName}
          </>
        )}
      </p>
      <p
        className={cn(
          "num text-[14.5px]",
          direction === "pays" ? "text-coral" : "text-emerald dark:text-mint",
        )}
      >
        {formatMoney(amount, currency)}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Use it from `MemberBalanceView`**

In `src/components/members/MemberBalanceView.tsx`, add the import:

```tsx
import { MemberTransferRow } from "./MemberTransferRow";
```

Replace the inline transfer-row markup inside `EventBalanceSection` ([MemberBalanceView.tsx:117-141](src/components/members/MemberBalanceView.tsx:117)):

```tsx
      <div className="mt-4 divide-y divide-ink/8 border-t border-ink/8 dark:divide-white/8 dark:border-white/8">
        {event.transfers.map((t) => (
          <MemberTransferRow
            key={t.otherMemberId}
            memberName={memberName}
            otherName={t.otherName}
            direction={t.direction}
            amount={t.amount}
            currency={event.currency}
          />
        ))}
      </div>
```

- [ ] **Step 3: Visual check**

Run: `npm run dev`, open a member's Balance tab that has at least one unsettled transfer.
Expected: rows render identically to before (same text, same colors) — this step is a pure extraction, no visual change.

- [ ] **Step 4: Commit**

```bash
git add src/components/members/MemberTransferRow.tsx src/components/members/MemberBalanceView.tsx
git commit -m "refactor: extract MemberTransferRow for reuse by the activity screen"
```

---

### Task 5: `MemberEventActivityView` + its route

**Files:**
- Create: `src/components/members/MemberEventActivityView.tsx`
- Create: `src/app/g/[groupId]/events/[eventId]/members/[memberId]/page.tsx`

**Interfaces:**
- Consumes: `MemberEventActivity` shape from Task 2 (serialized: `lines[].createdAt` is a `Date` and needs the same ISO-string conversion used elsewhere; every other field is already a primitive).
- Produces: the `MemberEventActivityView` component, and the route `/g/[groupId]/events/[eventId]/members/[memberId]`. Task 6 (generalized `MemberChip`) links to this route once it exists — building the route here, before Task 6 repoints the chip at it, means there's no intermediate dead link.

- [ ] **Step 1: Create the view component**

No `"use client"` needed — like its sibling `MemberBalanceView` (not `MemberExpenseView`, which needs client state for the currency switcher and collapsible event list), this screen has no interactivity of its own, so it stays a Server Component:

```tsx
import Link from "next/link";
import { GroupHeader } from "@/components/group/GroupHeader";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { formatMoney } from "@/lib/format";
import { MemberTransferRow } from "./MemberTransferRow";
import { Receipt } from "lucide-react";

interface MemberActivityBillLineView {
  billId: string;
  title: string;
  totalAmount: number;
  payerId: string;
  payerName: string;
  isPayer: boolean;
  shareAmount: number;
  createdAt: string;
}

interface MemberActivityTransferView {
  otherMemberId: string;
  otherName: string;
  direction: "pays" | "receives";
  amount: number;
}

interface MemberEventActivityViewProps {
  groupId: string;
  groupName: string;
  actorType: "member" | "visitor";
  member: { id: string; name: string; avatarColor: string; isActive: boolean };
  event: { id: string; name: string; currency: string };
  share: number;
  paid: number;
  net: number;
  lines: MemberActivityBillLineView[];
  transfers: MemberActivityTransferView[];
}

// The event dashboard's member-chip destination: everything about one
// member in exactly this one event -- their bills, their share, and what
// settling this event would move for them. Deliberately a single page, not
// tabs like the cross-event Expenses/Balance screens (MemberExpenseView /
// MemberBalanceView) -- one event's worth of data is small enough that
// splitting it across two screens would just be friction, and having a
// visibly different shape from those two screens is itself part of what
// keeps "this event" from being confused with "every event".
export function MemberEventActivityView({
  groupId,
  groupName,
  actorType,
  member,
  event,
  share,
  paid,
  net,
  lines,
  transfers,
}: MemberEventActivityViewProps) {
  const backHref = `/g/${groupId}/events/${event.id}`;

  return (
    <div className="min-h-screen bg-cream px-5 py-6 sm:px-9 sm:py-9 dark:bg-dark-bg">
      <div className="mx-auto max-w-[720px]">
        <GroupHeader groupId={groupId} groupName={groupName} actorType={actorType} />

        <Link href={backHref} className="mb-4 block text-[13px] font-bold text-link dark:text-mint">
          ← Back to {event.name}
        </Link>

        <div className="rounded-lg border border-ink/7 bg-white p-4 sm:p-7 dark:border-white/7 dark:bg-dark-card">
          <div className="mb-4 flex items-center gap-3 sm:mb-5 sm:gap-3.5">
            <InitialsAvatar name={member.name} color={member.avatarColor} size={52} className="text-lg" />
            <div>
              <h1 className="num text-[20px] text-ink sm:text-[26px] dark:text-dark-text">
                {member.name}&rsquo;s activity in {event.name}
              </h1>
              <p className="mt-0.5 text-[12.5px] text-muted sm:text-[13px] dark:text-dark-muted">
                Bills, spend, and settlement for {member.name} in {event.name} only — nothing
                from their other events.
              </p>
            </div>
          </div>

          {lines.length === 0 ? (
            <EmptyActivityState memberName={member.name} eventName={event.name} />
          ) : (
            <>
              <p className="mb-1 text-[11.5px] font-bold tracking-wide text-muted-2 uppercase">
                Their share in this event
              </p>
              <p className="num text-[28px] text-ink sm:text-[38px] dark:text-dark-text">
                {formatMoney(share, event.currency)}
              </p>
              <p className="mt-1.5 text-[13.5px] text-muted dark:text-dark-muted">
                {member.name} paid{" "}
                <span className="num text-ink dark:text-dark-text">{formatMoney(paid, event.currency)}</span> of
                these bills themselves
              </p>

              {net !== 0 && (
                <div className="mt-5 border-t border-ink/8 pt-4 sm:mt-6 dark:border-white/8">
                  <p className="mb-1 text-[11.5px] font-bold tracking-wide text-muted-2 uppercase">
                    {net > 0 ? "Owed to" : "Owed by"} {member.name} in this event
                  </p>
                  <p
                    className={`num text-[22px] sm:text-[28px] ${net > 0 ? "text-emerald dark:text-mint" : "text-coral"}`}
                  >
                    {net > 0 ? "+" : "-"}
                    {formatMoney(Math.abs(net), event.currency)}
                  </p>
                  <div className="mt-3 divide-y divide-ink/8 border-t border-ink/8 dark:divide-white/8 dark:border-white/8">
                    {transfers.map((t) => (
                      <MemberTransferRow
                        key={t.otherMemberId}
                        memberName={member.name}
                        otherName={t.otherName}
                        direction={t.direction}
                        amount={t.amount}
                        currency={event.currency}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {lines.length > 0 && (
          <>
            <p className="mt-5 mb-2.5 text-[12.5px] font-bold tracking-wide text-muted-2 uppercase sm:mt-7 sm:mb-3">
              Bills in this event
            </p>
            <div className="rounded-lg border border-ink/7 bg-white px-4 dark:border-white/7 dark:bg-dark-card">
              <div className="divide-y divide-ink/8 dark:divide-white/8">
                {lines.map((line) => (
                  <div key={line.billId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-ink dark:text-dark-text">{line.title}</p>
                      <p className="mt-0.5 text-[12px] text-muted-2">
                        {formatMoney(line.totalAmount, event.currency)} total ·{" "}
                        {line.isPayer ? (
                          <span className="font-semibold text-emerald dark:text-mint">they paid</span>
                        ) : (
                          <>paid by {line.payerName}</>
                        )}
                      </p>
                    </div>
                    <p className="num shrink-0 text-[14.5px] text-ink dark:text-dark-text">
                      {formatMoney(line.shareAmount, event.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyActivityState({ memberName, eventName }: { memberName: string; eventName: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint">
        <Receipt className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mb-1.5 text-[15px] font-bold text-ink dark:text-dark-text">No activity yet</p>
      <p className="max-w-[320px] text-[13px] text-muted dark:text-dark-muted">
        {memberName} hasn&rsquo;t paid for or been split on any bill in {eventName} yet.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Create the route**

```tsx
import { redirect } from "next/navigation";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { getMemberEventActivity } from "@/lib/expenses";
import { prisma } from "@/lib/prisma";
import { MemberEventActivityView } from "@/components/members/MemberEventActivityView";

// Screen Spec companion to P4-01 (event dashboard): the member chip's
// "View activity" destination, scoped to exactly this event. requireSession()
// with no role requirement -- viewers see this too, same as every other
// member-detail screen.
export default async function MemberEventActivityPage({
  params,
}: {
  params: Promise<{ groupId: string; eventId: string; memberId: string }>;
}) {
  const { groupId, eventId, memberId } = await params;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const [group, activity] = await Promise.all([
    prisma.group.findUnique({ where: { id: groupId }, select: { name: true } }),
    getMemberEventActivity(memberId, eventId, groupId),
  ]);
  if (!group) redirect("/");
  if (!activity) redirect(`/g/${groupId}/events/${eventId}`);

  return (
    <MemberEventActivityView
      groupId={groupId}
      groupName={group.name}
      actorType={session.actorType}
      member={activity.member}
      event={activity.event}
      share={activity.share}
      paid={activity.paid}
      net={activity.net}
      lines={activity.lines.map((line) => ({ ...line, createdAt: line.createdAt.toISOString() }))}
      transfers={activity.transfers}
    />
  );
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/members/MemberEventActivityView.tsx \
  src/app/g/\[groupId\]/events/\[eventId\]/members/\[memberId\]/page.tsx
git commit -m "feat: add single-event member activity screen and route"
```

---

### Task 6: Generalize `MemberChip` for an optional event context

**Files:**
- Modify: `src/components/members/MemberChip.tsx`

**Interfaces:**
- Produces: `MemberChip` now accepts `eventId?: string` and `currency?: string` (both previously required), and `ChipMember.balance` becomes optional (`balance?: number`). With `eventId` present: unchanged behavior (balance line shown, menu action labeled "View activity", links to `/g/{groupId}/events/{eventId}/members/{memberId}` — the route Task 5 created). Without it: no balance line, menu action labeled "View expenses", links to `/g/{groupId}/members/{memberId}/expenses`. Task 7 consumes the event-less mode.

The event dashboard ([EventDashboard.tsx:131-141](src/components/events/EventDashboard.tsx:131)) already passes `eventId`/`currency`/a numeric `balance` for every chip it renders, so no caller changes are needed there — only this component's internals change.

- [ ] **Step 1: Update the props and the derived label/href**

In `src/components/members/MemberChip.tsx`, change `ChipMember` ([:20-26](src/components/members/MemberChip.tsx:20)):

```tsx
export interface ChipMember {
  id: string;
  name: string;
  avatarColor: string;
  isActive: boolean;
  /** Net balance for one event. Omitted in group-wide contexts (the /events
   * member list) where there's no single event to net over -- the card
   * just doesn't show a balance line rather than showing a misleading 0. */
  balance?: number;
}
```

Change `MemberChipProps` ([:28-37](src/components/members/MemberChip.tsx:28)):

```tsx
interface MemberChipProps {
  member: ChipMember;
  currency?: string;
  groupId: string;
  /** Present when rendered from an event dashboard -- shows the balance
   * line and labels the menu action "View activity" (opens the
   * single-event screen). Absent when rendered from the group's /events
   * list -- no balance line, action labeled "View expenses" (opens the
   * cross-event screen). Both modes share the same menu, rename modal, and
   * deactivate/reactivate actions -- those aren't event-specific. */
  eventId?: string;
  canEdit: boolean;
  onRenamed: (id: string, name: string) => void;
  onRequestDeactivate: (id: string, name: string) => void;
  onReactivated: (id: string) => void;
}
```

Change `ActionMenuItem["id"]` ([:14](src/components/members/MemberChip.tsx:14)) — `"expenses"` becomes `"activity"`.

Replace the `useCountUp` line and the `expensesHref` line ([:67-69](src/components/members/MemberChip.tsx:67)):

```tsx
  const balance = useCountUp(member.balance ?? 0);

  const activityHref = eventId
    ? `/g/${groupId}/events/${eventId}/members/${member.id}`
    : `/g/${groupId}/members/${member.id}/expenses`;
  const activityLabel = eventId ? "View activity" : "View expenses";
```

Update `handleAction` ([:85-89](src/components/members/MemberChip.tsx:85)):

```tsx
  function handleAction(key: Key) {
    if (key === "activity") router.push(activityHref);
    if (key === "rename") setRenaming(true);
    if (key === "deactivate") onRequestDeactivate(member.id, member.name);
  }
```

Replace the `viewExpenses` menu item definition ([:91](src/components/members/MemberChip.tsx:91)) and its references in `menuItems` ([:92-100](src/components/members/MemberChip.tsx:92)):

```tsx
  const viewActivity: ActionMenuItem = { id: "activity", label: activityLabel, icon: Receipt };
  const menuItems: ActionMenuItem[] = !canEdit
    ? [viewActivity]
    : member.isActive
      ? [
          viewActivity,
          { id: "rename", label: "Rename", icon: Pencil },
          { id: "deactivate", label: "Deactivate", icon: UserMinus, danger: true },
        ]
      : [viewActivity, { id: "reactivate", label: "Reactivate" }];
```

- [ ] **Step 2: Make the balance line conditional in both active-member layouts**

Replace the `balanceText`/`balanceColor` block just above the final `return` ([:185-193](src/components/members/MemberChip.tsx:185)):

```tsx
  const hasBalance = member.balance !== undefined && currency !== undefined;
  const balanceText = !hasBalance
    ? null
    : member.balance === 0
      ? "Settled up"
      : `${member.balance! > 0 ? "+" : "-"}${formatMoney(Math.abs(balance), currency!)}`;
  const balanceColor = cn(
    hasBalance && member.balance! > 0 && "text-emerald dark:text-mint",
    hasBalance && member.balance! < 0 && "text-coral",
    hasBalance && member.balance === 0 && "text-muted dark:text-dark-muted",
  );
```

In the mobile compact card ([:200-207](src/components/members/MemberChip.tsx:200)), change the unconditional balance `<p>` to:

```tsx
        {balanceText && <p className={cn("num text-[12px]", balanceColor)}>{balanceText}</p>}
```

In the desktop wide chip ([:210-217](src/components/members/MemberChip.tsx:210)), change its balance `<p>` the same way:

```tsx
          {balanceText && <p className={cn("num text-[15px]", balanceColor)}>{balanceText}</p>}
```

Leave the inactive-member branch ([:147-183](src/components/members/MemberChip.tsx:147)) untouched — it never showed a balance to begin with.

- [ ] **Step 3: Update the file's own doc comment**

The comment above the component ([:44-53](src/components/members/MemberChip.tsx:44)) currently says `"one labelled overflow menu (View expenses / Rename / Deactivate)"` — update to describe both label variants, e.g. `"one labelled overflow menu (View activity or View expenses, depending on whether an event context is present / Rename / Deactivate)"`.

- [ ] **Step 4: Type-check and manual check**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev`, open an event dashboard (`/g/{groupId}/events/{eventId}`), open a member chip's `⋯` menu.
Expected: menu shows "View activity" (not "View expenses"); the balance line still renders as before; clicking "View activity" opens the single-event screen built in Task 5, showing only that event's bills/share/settlement.

- [ ] **Step 5: Commit**

```bash
git add src/components/members/MemberChip.tsx
git commit -m "feat: generalize MemberChip for an optional event context"
```

---

### Task 7: Group-wide member management on `/events`

**Files:**
- Create: `src/lib/members.ts`
- Modify: `src/components/events/EventsListView.tsx`
- Modify: `src/app/g/[groupId]/events/page.tsx`

**Interfaces:**
- Consumes: `MemberChip`/`ChipMember` (Task 6) in its event-less mode; `DeactivateConfirmModal` (existing, unchanged).
- Produces: `listGroupMembers(groupId: string): Promise<GroupMemberSummary[]>`, `GroupMemberSummary = { id: string; name: string; avatarColor: string; isActive: boolean }` — structurally assignable to `ChipMember` since `balance` is optional there.

- [ ] **Step 1: `listGroupMembers`**

```ts
import { prisma } from "@/lib/prisma";

export interface GroupMemberSummary {
  id: string;
  name: string;
  avatarColor: string;
  isActive: boolean;
}

/** Shared by the /events page's member list -- no balance, no per-event
 * context, just who's in the group. Inactive members stay listed
 * (CLAUDE.md rule 4: members are never deleted) -- MemberChip's own
 * opacity/label handles signaling that, same as it already does on the
 * event dashboard. */
export async function listGroupMembers(groupId: string): Promise<GroupMemberSummary[]> {
  return prisma.member.findMany({
    where: { groupId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, avatarColor: true, isActive: true },
  });
}
```

- [ ] **Step 2: Wire into `EventsListView`**

In `src/components/events/EventsListView.tsx`, add imports:

```tsx
import { DeactivateConfirmModal } from "@/components/members/DeactivateConfirmModal";
import { MemberChip, type ChipMember } from "@/components/members/MemberChip";
```

Add `members: ChipMember[];` to `EventsListViewProps` ([EventsListView.tsx:24-31](src/components/events/EventsListView.tsx:24)) and to the destructured props ([:34-41](src/components/events/EventsListView.tsx:34)).

Add local state next to the existing `showCreateEvent`/`showShare` state ([:43-44](src/components/events/EventsListView.tsx:43)):

```tsx
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);
```

Add the rename handler (mirrors `EventDashboard`'s `handleRename`):

```tsx
  async function handleRename(memberId: string, name: string) {
    await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    router.refresh();
  }
```

Insert the members section right after the breadcrumb/Share row ([:82](src/components/events/EventsListView.tsx:82), before the `{events.length === 0 ? ... }` block):

```tsx
        {members.length > 0 && (
          <>
            <p className="mb-3 text-[12.5px] font-bold tracking-wide text-muted-2 uppercase dark:text-dark-muted">
              Members
            </p>
            <div className="mb-6 flex gap-3 overflow-x-auto pb-1 sm:mb-8 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {members.map((member) => (
                <MemberChip
                  key={member.id}
                  member={member}
                  groupId={groupId}
                  canEdit={canEdit}
                  onRenamed={handleRename}
                  onRequestDeactivate={(id, name) => setDeactivateTarget({ id, name })}
                  onReactivated={() => router.refresh()}
                />
              ))}
            </div>
          </>
        )}
```

Note: no `eventId`/`currency` props are passed — this is exactly what puts `MemberChip` into its event-less mode from Task 6.

Add the modal near the other modals at the bottom of the component ([:128-138](src/components/events/EventsListView.tsx:128), alongside `showCreateEvent`/`showShare`):

```tsx
      {deactivateTarget && (
        <DeactivateConfirmModal
          memberId={deactivateTarget.id}
          memberName={deactivateTarget.name}
          onClose={() => setDeactivateTarget(null)}
          onDeactivated={() => {
            setDeactivateTarget(null);
            router.refresh();
          }}
        />
      )}
```

- [ ] **Step 3: Fetch and pass members from the page**

In `src/app/g/[groupId]/events/page.tsx`, add the import:

```ts
import { listGroupMembers } from "@/lib/members";
```

Replace the single `const events = await listGroupEvents(groupId);` line with:

```ts
  const [events, members] = await Promise.all([listGroupEvents(groupId), listGroupMembers(groupId)]);
```

Pass `members={members}` to `<EventsListView>` alongside the existing props.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `/g/{groupId}/events` for a group with at least 2 members (include an inactive one if you have one).

Expected:
- A "Members" row appears above "Your events" with the same chip style used on the event dashboard, minus a balance line.
- The inactive member's card renders dimmed with "Reactivate" as its only extra menu item (for editors) or is view-only (for viewers) — same as the event dashboard.
- Opening the `⋯` menu on an active member (as an editor) shows "View expenses", "Rename", "Deactivate". Clicking "View expenses" opens that member's cross-event Expenses tab; renaming updates the name in place after `router.refresh()`; deactivating shows the confirm modal and dims the card afterward.
- As a viewer, the menu shows only "View expenses".

- [ ] **Step 5: Commit**

```bash
git add src/lib/members.ts src/components/events/EventsListView.tsx src/app/g/\[groupId\]/events/page.tsx
git commit -m "feat: add group-wide member management to the events list page"
```

---

### Task 8: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass, including the new `computeMemberEventBalance` cases from Task 1.

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build, no type errors.

- [ ] **Step 3: Manual walkthrough**

Run: `npm run dev`. In one group with 2+ events (different currencies if you have them) and 2+ members, one with bills in both events:

1. Open `/g/{groupId}/events`. Confirm the "Members" row appears above "Your events" with the same chip styling as the event dashboard, no balance figures. Rename a member from here and confirm it updates. Deactivate one and confirm it dims and gains "Reactivate"; reactivate it.
2. From that same list, open a member's `⋯` menu → "View expenses". Confirm the subtitle reads "...across every event in {groupName}" and the back link goes to `/g/{groupId}/events` (not a specific event).
3. Go to the Balance tab for the same member; confirm the subtitle wording and back link match the same pattern.
4. Go to one event's dashboard (`/g/{groupId}/events/{eventId}`), open a member chip's `⋯` menu — confirm it still shows a balance line and now says "View activity" — and click it.
5. Confirm the resulting screen is titled "{name}'s activity in {eventName}", shows only that event's bills/share, and (if unsettled) only that event's settlement transfers — bills from the member's other event must not appear.
6. Confirm "← Back to {eventName}" returns to that event's dashboard.
7. Pick a member with zero bills in one event; open their activity screen for that event and confirm the "No activity yet" empty state renders.
8. Rename and deactivate a member from the event dashboard too (the original entry point) — confirm both still work identically to before this plan.
9. Check the `/events` member list and the new activity screen at 375px width and in dark mode — no layout breaks, no unstyled dark-mode text.

- [ ] **Step 4: Confirm no regressions in existing flows**

Manually re-check: settle-up flow still reachable and unaffected; group/account pages (My Groups, tutorial) unaffected — this plan touches nothing under `src/app/account` or `src/components/group`/`tutorial`.

---

## Rollback

- No schema migration in this plan — a `git revert` per commit is safe on its own.
- Task 1's `getMemberBalance` refactor changes no return shape, only where the math is computed — reverting it alone is safe if something regresses there without needing to revert later tasks.
- Task 6 (generalizing `MemberChip`) and Task 7 (wiring it into `/events`) are separable: reverting Task 7 alone removes the `/events` member list but leaves the event dashboard's chip working in its new "View activity" form; reverting both returns to the pre-plan state entirely.
- The new route (`events/[eventId]/members/[memberId]`) and the cross-event routes are independent of each other.

## Out of scope (unchanged from the prior plan's backlog)

Further member-expense-view enhancements beyond this scope, and the password-reset implementation, remain explicitly deferred — this plan only covers the group-wide member list / event-scoped activity split described above.
