# Rename & Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the four approved features from
`docs/superpowers/specs/2026-08-06-rename-and-archive-design.md`: group
rename from the groups list (A), archived-events UI with money exclusion
(B), archived groups with link gating (C), and a real-world-payment
acknowledgment on the settle confirmation (D).

**Architecture:** Four independent branches/PRs off `main`, in order
A → B → C → D (C reuses A's route and menu). Every mutation is
server-validated; UI gating is convenience only (CLAUDE.md rule 9). New
pure logic gets Vitest; routes and UI are hand-verified against the dev
server per the repo's testing convention.

**Tech Stack:** Next.js 15 App Router, TypeScript, Prisma, Zod, Vitest,
Tailwind, react-aria-components (menus), lucide-react (icons).

## Global Constraints

- Money is integers in minor units; none of these features touch amounts, splits, or settlements (CLAUDE.md rule 1 untouched by design).
- Settled bills stay immutable — feature D is client-side copy/gating only; the confirm API is not modified (rule 10).
- Members/groups are never deleted; events and groups are archived via `status`, never removed (rule 4).
- All DB access via server code (rule 7); `viewer` role and owner gates enforced server-side (rule 9).
- Vitest covers pure/isolable logic only — Zod schemas and decision predicates. No route-handler or component tests; those are hand-verified against `npm run dev`.
- Commit messages: no Co-Authored-By line (user preference).
- PRs use the writing-pull-requests skill format.
- Each Part starts from fresh `main` (after the previous Part's PR merges): `git checkout main && git pull && git checkout -b <branch>`.

---

# Part A — Group rename (branch `group-rename-from-list`)

### Task A1: `updateGroupSchema` Zod schema

**Files:**
- Modify: `src/lib/validation/group.ts`
- Test: `src/lib/validation/group.test.ts` (exists — extend it)

**Interfaces:**
- Produces: `updateGroupSchema` — parses `{ name: string }` (trimmed, min 1). Exported type `UpdateGroupInput`. Task C1 later extends this same schema with `status`; here it is name-only.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/validation/group.test.ts`:

```ts
import { updateGroupSchema } from "./group";

describe("updateGroupSchema", () => {
  it("accepts a plain rename and trims it", () => {
    const parsed = updateGroupSchema.parse({ name: "  Bali Trip Crew  " });
    expect(parsed.name).toBe("Bali Trip Crew");
  });

  it("rejects an empty or whitespace-only name", () => {
    expect(updateGroupSchema.safeParse({ name: "" }).success).toBe(false);
    expect(updateGroupSchema.safeParse({ name: "   " }).success).toBe(false);
  });

  it("rejects an empty payload", () => {
    expect(updateGroupSchema.safeParse({}).success).toBe(false);
  });
});
```

(Match the existing file's import style — if it already imports from
`./group`, merge into that import statement.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/validation/group.test.ts`
Expected: FAIL — `updateGroupSchema` is not exported.

- [ ] **Step 3: Implement the schema**

Append to `src/lib/validation/group.ts`:

```ts
// PATCH /api/account/groups/{groupId} — owner-only rename (spec 2026-08-06
// feature A). No length cap for the same reason RenameEventModal has none:
// group names are never rendered into narrow chips or settlement rows.
export const updateGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
});

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/validation/group.test.ts`
Expected: PASS (all, including pre-existing).

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation/group.ts src/lib/validation/group.test.ts
git commit -m "feat: add updateGroupSchema for owner-gated group rename"
```

### Task A2: `PATCH /api/account/groups/{groupId}` route

**Files:**
- Create: `src/app/api/account/groups/[groupId]/route.ts`

**Interfaces:**
- Consumes: `updateGroupSchema` (Task A1), `getGroupOwner` (`src/lib/account.ts`), `requireUserSession` (`src/lib/auth/require-user-session.ts`), `assertSameOrigin`/`CsrfError` (`src/lib/auth/assert-same-origin.ts`), `SessionError` (`src/lib/auth/require-session.ts`).
- Produces: `PATCH /api/account/groups/{groupId}` accepting `{ name }`, returning `{ group: { id, name } }`. 401 no user session, 403 non-owner, 404 unknown group, 400 invalid body. Task C2 extends this same handler with `status`.

Note this is the **account** namespace (user-session-authenticated),
NOT `/api/groups/[id]` (group-session-authenticated) — the caller is on
`/account/groups` and holds `fst_user_session`, not a group cookie. The
sibling `enter/route.ts` in the same folder is the pattern to follow.

- [ ] **Step 1: Write the route**

Create `src/app/api/account/groups/[groupId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { assertSameOrigin, CsrfError } from "@/lib/auth/assert-same-origin";
import { requireUserSession } from "@/lib/auth/require-user-session";
import { SessionError } from "@/lib/auth/require-session";
import { getGroupOwner } from "@/lib/account";
import { prisma } from "@/lib/prisma";
import { updateGroupSchema } from "@/lib/validation/group";

// PATCH: rename a group from the My Groups page (spec 2026-08-06 feature
// A). Owner-only — same gate as share-link regeneration: the earliest
// editor GroupMembership (getGroupOwner) is the owner. Lives in the
// account namespace because the caller holds fst_user_session, not a
// group-context cookie (contrast /api/groups/[id], which requireSession()s
// the group cookie).
export async function PATCH(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  let session;
  try {
    assertSameOrigin(request);
    session = await requireUserSession();
  } catch (error) {
    if (error instanceof CsrfError || error instanceof SessionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateGroupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const owner = await getGroupOwner(groupId);
  if (!owner || owner.userId !== session.userId) {
    return NextResponse.json({ error: "Only the group owner can do this" }, { status: 403 });
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: { name: parsed.data.name },
  });

  return NextResponse.json({ group: { id: updated.id, name: updated.name } });
}
```

Check `requireUserSession`'s actual export/throw shape in
`src/lib/auth/require-user-session.ts` before wiring — the groups page
uses `getCurrentUserId`; if `requireUserSession` throws something other
than `SessionError`, mirror what `enter/route.ts` catches.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx next lint --dir src/app/api/account 2>/dev/null || npm run build`
Expected: no type errors. (No route-test harness exists — hand
verification happens in Task A3.)

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/account/groups/[groupId]/route.ts"
git commit -m "feat: owner-gated PATCH /api/account/groups/{groupId} for rename"
```

### Task A3: RenameGroupModal + overflow menu in MyGroupsView

**Files:**
- Create: `src/components/group/RenameGroupModal.tsx`
- Modify: `src/components/account/MyGroupsView.tsx`

**Interfaces:**
- Consumes: `PATCH /api/account/groups/{groupId}` (Task A2).
- Produces: `RenameGroupModal({ groupId, currentName, onClose, onRenamed })`; `GroupCard` gains a `canOwn`-independent menu (server is the real gate; in Part C Task C5 the menu becomes owner-conditional — here every card shows it, and non-owners get the API's 403 error message in the modal).

- [ ] **Step 1: Create the modal**

`src/components/group/RenameGroupModal.tsx` — pattern-copy of
`src/components/events/RenameEventModal.tsx` (read it first; keep the
identical shell, classNames, and Enter-to-save behavior). Differences
only:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface RenameGroupModalProps {
  groupId: string;
  currentName: string;
  onClose: () => void;
  onRenamed: (name: string) => void;
}

// Reached from the group card's overflow menu on /account/groups. Mirrors
// RenameEventModal's shell so the rename flows read as one idiom. The
// server gate is owner-only (getGroupOwner) — a 403 here surfaces as the
// generic error line.
export function RenameGroupModal({ groupId, currentName, onClose, onRenamed }: RenameGroupModalProps) {
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  async function handleSave() {
    if (!canSubmit) return;
    if (trimmed === currentName) {
      onClose();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        setError(
          res.status === 403
            ? "Only the group owner can rename this group."
            : "Couldn't rename — check your connection and try again.",
        );
        setSubmitting(false);
        return;
      }
      onRenamed(trimmed);
    } catch {
      setError("Couldn't rename — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-4.5 text-xl text-ink sm:text-[22px] dark:text-dark-text">Rename group</h2>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Name</label>
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
          />
        </div>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={handleSave} className="flex-1 text-center">
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the overflow menu to GroupCard**

In `src/components/account/MyGroupsView.tsx`:

1. Add imports:

```tsx
import { useRouter } from "next/navigation";
import { RenameGroupModal } from "@/components/group/RenameGroupModal";
import { Button as AriaButton, Menu, MenuItem, MenuTrigger, Popover, type Key } from "react-aria-components";
import { MoreVertical, Pencil } from "lucide-react";
```

2. In `MyGroupsView`, add state + router, and render the modal:

```tsx
const router = useRouter();
const [renameTarget, setRenameTarget] = useState<GroupSummary | null>(null);
```

```tsx
{renameTarget && (
  <RenameGroupModal
    groupId={renameTarget.groupId}
    currentName={renameTarget.name}
    onClose={() => setRenameTarget(null)}
    onRenamed={() => {
      setRenameTarget(null);
      router.refresh();
    }}
  />
)}
```

(place alongside the existing `CreateGroupModal` render), and pass
`onRequestRename={setRenameTarget}` down to each `GroupCard`.

3. Rework `GroupCard`: the card is a `<form><button>` (POST to enter the
group). A `<button>` may not contain another `<button>`, so — exactly as
`EventCard` in `src/components/events/EventsListView.tsx` does — wrap in
`<div className="relative">`, keep the form as-is (add `pr-7` padding to
the name row so text never sits under the trigger), and absolutely
position the menu as a *sibling*:

```tsx
function GroupCard({
  group,
  onRequestRename,
}: {
  group: GroupSummary;
  onRequestRename: (group: GroupSummary) => void;
}) {
  const color = colorForSeed(group.groupId);
  const letter = group.name.trim().charAt(0).toUpperCase() || "?";

  // The menu is a sibling of the form's submit button, not a child: a
  // <button> may not contain a <button>, and nesting would submit the
  // enter-group form on every menu click (same reasoning as EventCard).
  return (
    <div className="relative">
      <form method="POST" action={`/api/account/groups/${group.groupId}/enter`}>
        {/* existing submit button unchanged, but add pr-7 to the inner
            flex row's className so the name clears the menu trigger */}
      </form>
      <div className="absolute top-3 right-3 sm:top-5 sm:right-5">
        <MenuTrigger>
          <AriaButton
            aria-label={`Actions for ${group.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-2 outline-none hover:bg-ink/6 data-[pressed]:bg-ink/10 dark:hover:bg-white/8"
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </AriaButton>
          <Popover className="min-w-[172px] rounded-md border border-ink/10 bg-white p-1 shadow-[0_16px_32px_-14px_rgba(19,46,40,0.35)] dark:border-white/10 dark:bg-dark-card">
            <Menu
              className="outline-none"
              onAction={(key: Key) => {
                if (key === "rename") onRequestRename(group);
              }}
            >
              <MenuItem
                id="rename"
                className="flex cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13.5px] font-semibold text-ink outline-none data-[focused]:bg-ink/6 dark:text-dark-text dark:data-[focused]:bg-white/8"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Rename
              </MenuItem>
            </Menu>
          </Popover>
        </MenuTrigger>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Hand-verify against the dev server**

Start the dev server (use the launch.json/preview tooling, not raw Bash).
Verify:
1. Log in, open `/account/groups` — every card shows the ⋮ menu.
2. Rename an owned group → modal, save → card updates without reload.
3. Rename to whitespace → Save disabled.
4. `fetch` a PATCH for a group the user doesn't own (or log in as a
   second user in a private window) → 403 and the owner-only error line.
5. Enter-group navigation still works when clicking the card body, and
   clicking ⋮ does NOT navigate.

- [ ] **Step 4: Commit, push, PR**

```bash
git add src/components/group/RenameGroupModal.tsx src/components/account/MyGroupsView.tsx
git commit -m "feat: add group rename to the My Groups page"
git push -u origin group-rename-from-list
```

Open the PR with the writing-pull-requests skill format. Wait for merge
before Part B (Parts B/C/D branch from updated main).

---

# Part B — Archived events UI (branch `archived-events-ui`)

### Task B1: exclude archived events from member math + expose `unsettledCount`

**Files:**
- Modify: `src/lib/events.ts` (listGroupEvents)
- Modify: `src/lib/expenses/index.ts` (getMemberExpenses, getMemberBalance)

**Interfaces:**
- Produces: `listGroupEvents` rows gain `unsettledCount: number` (count of unsettled bills). `getMemberExpenses` and `getMemberBalance` silently ignore archived events. `getMemberEventActivity` is **deliberately untouched** — it is scoped to one event and reached from inside that event's own dashboard; blanking it would make an archived event's pages useless (spec: archived events remain navigable).

- [ ] **Step 1: Add `unsettledCount` to listGroupEvents**

In `src/lib/events.ts`, inside the `events.map` return object, add:

```ts
unsettledCount: event.bills.filter((bill) => bill.status === "unsettled").length,
```

(next to the existing `unsettledAmount`; reuse one filtered array:
`const unsettledBills = event.bills.filter((b) => b.status === "unsettled")`
then derive both `unsettledAmount` and `unsettledCount` from it.)

- [ ] **Step 2: Filter archived events out of member math**

In `src/lib/expenses/index.ts`:

- `getMemberExpenses` — in the `prisma.event.findMany` where clause, add
  `status: "active"`:

```ts
where: {
  groupId,
  status: "active",
  OR: [ /* existing three clauses unchanged */ ],
},
```

- `getMemberBalance` — same addition:

```ts
where: { groupId, status: "active", eventMembers: { some: { memberId } } },
```

Update each function's doc comment to note archived events are excluded
(spec 2026-08-06 feature B: archived = out of all member math until
restored). Do NOT touch `getMemberEventActivity` — add a sentence to its
doc comment explaining why it stays unfiltered (single-event scope,
reached from inside the event).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: clean. (These are Prisma-coupled query functions — per repo
convention they're hand-verified, not Vitest-tested.)

- [ ] **Step 4: Commit**

```bash
git add src/lib/events.ts src/lib/expenses/index.ts
git commit -m "feat: exclude archived events from member expense and balance math"
```

### Task B2: ArchiveEventModal + archive/restore menu actions

**Files:**
- Create: `src/components/events/ArchiveEventModal.tsx`
- Modify: `src/components/events/EventsListView.tsx`

**Interfaces:**
- Consumes: `PATCH /api/events/{id}` with `{ status: "archived" | "active" }` (already exists, editor-gated); `EventSummary.unsettledCount` (Task B1); `formatMoney` (`src/lib/format.ts`).
- Produces: `ArchiveEventModal({ event, onClose, onArchived })` where `event` is an `EventSummary`; menu gains `archive` (active events) / `restore` (archived events) keys. Restore needs no modal — it is non-destructive.

- [ ] **Step 1: Create ArchiveEventModal**

`src/components/events/ArchiveEventModal.tsx` — same modal shell as
`RenameEventModal` (overlay + card + Cancel/primary buttons):

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { formatMoney } from "@/lib/format";

interface ArchiveEventModalProps {
  event: {
    id: string;
    name: string;
    currency: string;
    unsettledCount: number;
    unsettledAmount: number;
  };
  onClose: () => void;
  onArchived: () => void;
}

// Warn-but-allow (spec 2026-08-06 feature B): archiving hides the event's
// amounts from every member's expenses and balances until restore, so when
// unsettled bills exist the modal says exactly what disappears. Restore
// needs no modal — it is non-destructive.
export function ArchiveEventModal({ event, onClose, onArchived }: ArchiveEventModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasUnsettled = event.unsettledCount > 0;

  async function handleArchive() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error("archive failed");
      onArchived();
    } catch {
      setError("Couldn't archive — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-2.5 text-xl text-ink sm:text-[22px] dark:text-dark-text">
          Archive {event.name}?
        </h2>
        <p className="mb-5 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
          {hasUnsettled ? (
            <>
              This event still has {event.unsettledCount} unsettled bill
              {event.unsettledCount === 1 ? "" : "s"} totalling{" "}
              <span className="num font-bold text-coral">
                {formatMoney(event.unsettledAmount, event.currency)}
              </span>
              . While archived, those amounts are hidden from everyone&apos;s
              balances and expense details. Restore the event any time to
              bring them back.
            </>
          ) : (
            <>
              The event moves to the Archived section and its amounts are
              hidden from expense details. Restore it any time.
            </>
          )}
        </p>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={submitting}
            onClick={handleArchive}
            className="flex-1 text-center"
          >
            Archive event
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire menu actions in EventsListView**

In `src/components/events/EventsListView.tsx`:

1. `EventSummary` interface gains `unsettledCount: number;` (Task B1
   provides it — also thread it through the events page props if typed
   there; check `src/app/g/[groupId]/events/page.tsx`).
2. Imports: `import { ArchiveEventModal } from "./ArchiveEventModal";`
   and add `Archive, ArchiveRestore` to the lucide-react import.
3. State: `const [archiveTarget, setArchiveTarget] = useState<EventSummary | null>(null);`
4. `EventCard` props gain `onRequestArchive: (event: EventSummary) => void`.
   In the `Menu` `onAction`:

```tsx
onAction={(key: Key) => {
  if (key === "rename") onRequestRename(event);
  if (key === "archive") onRequestArchive(event);
  if (key === "restore") handleRestore();
}}
```

with, inside `EventCard` (add `useRouter` import usage — the component
file already imports it):

```tsx
const router = useRouter();
async function handleRestore() {
  await fetch(`/api/events/${event.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "active" }),
  });
  router.refresh();
}
```

5. Menu items (below Rename, same MenuItem className as the existing
   Rename item):

```tsx
{!isArchived && (
  <MenuItem id="archive" className={/* same classes */}>
    <Archive className="h-3.5 w-3.5" aria-hidden="true" /> Archive
  </MenuItem>
)}
{isArchived && (
  <MenuItem id="restore" className={/* same classes */}>
    <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" /> Restore
  </MenuItem>
)}
```

(react-aria-components `Menu` accepts conditional children; if the
version in use complains, build an `items` array and render statically.)

6. Render the modal next to `RenameEventModal`:

```tsx
{archiveTarget && (
  <ArchiveEventModal
    event={archiveTarget}
    onClose={() => setArchiveTarget(null)}
    onArchived={() => {
      setArchiveTarget(null);
      router.refresh();
    }}
  />
)}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` — expected clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/events/ArchiveEventModal.tsx src/components/events/EventsListView.tsx "src/app/g/[groupId]/events/page.tsx"
git commit -m "feat: archive and restore actions on the event card menu"
```

### Task B3: Archived section in the events list

**Files:**
- Modify: `src/components/events/EventsListView.tsx`

**Interfaces:**
- Consumes: `EventSummary.status` (already present), Task B2's card menu (restore appears on archived cards).
- Produces: events list partitioned — active grid on top; a collapsed "Archived (N)" disclosure at the bottom rendering archived cards in the same grid. Empty state only when there are no events at all.

- [ ] **Step 1: Partition and render**

In `EventsListView`:

```tsx
const activeEvents = events.filter((e) => e.status === "active");
const archivedEvents = events.filter((e) => e.status === "archived");
const [showArchived, setShowArchived] = useState(false);
```

- The existing header count and grid switch from `events` to
  `activeEvents` (header: `{activeEvents.length} event…`).
- The `events.length === 0` empty-state check stays on the FULL list
  (a group whose only events are archived should show the archived
  section, not the empty state — change the condition to
  `activeEvents.length === 0 && archivedEvents.length === 0`).
- Below the active grid, when `archivedEvents.length > 0`:

```tsx
{archivedEvents.length > 0 && (
  <div className="mt-10">
    <button
      type="button"
      onClick={() => setShowArchived((v) => !v)}
      className="mb-4 flex items-center gap-2 text-[12.5px] font-bold tracking-wide text-muted-2 uppercase dark:text-dark-muted"
    >
      {showArchived ? "▾" : "▸"} Archived ({archivedEvents.length})
    </button>
    {showArchived && (
      <div className="grid grid-cols-1 gap-4 opacity-80 sm:grid-cols-2 sm:gap-5">
        {archivedEvents.map((event) => (
          <EventCard
            key={event.id}
            groupId={groupId}
            event={event}
            canEdit={canEdit}
            onRequestRename={setRenameEventTarget}
            onRequestArchive={setArchiveTarget}
          />
        ))}
      </div>
    )}
  </div>
)}
```

The card already renders its gold "Archived" pill via `isArchived`;
cards stay clickable (archived events remain navigable, per spec).

- [ ] **Step 2: Hand-verify against the dev server**

With seeded data (create a second event if needed):
1. Editor archives an event with 0 unsettled bills → simple modal copy,
   event moves to collapsed Archived section, header count drops.
2. Editor archives an event WITH unsettled bills → modal shows count +
   amount in coral; confirm → archived.
3. Open a member's Expenses and Balance tabs → the archived event's
   amounts are gone from both; restore → they return.
4. Viewer-role link: no ⋮ menu at all (existing `canEdit` gate), but the
   Archived section is visible and its cards open.
5. Direct `PATCH /api/events/{id}` with a viewer session → 403 (rule 9).
6. Archived event's own dashboard: still opens; per-event member
   activity (chip → event member page) still shows numbers.

- [ ] **Step 3: Commit, push, PR**

```bash
git add src/components/events/EventsListView.tsx
git commit -m "feat: collapsed archived section in the events list"
git push -u origin archived-events-ui
```

PR via writing-pull-requests skill. Merge before Part C.

---

# Part C — Archived groups (branch `archived-groups`)

### Task C1: migration + schema plumbing for `Group.status`

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/validation/group.ts`
- Test: `src/lib/validation/group.test.ts`

**Interfaces:**
- Produces: Prisma `GroupStatus` enum (`active | archived`), `Group.status` default `active`; `groupStatusSchema`; `updateGroupSchema` becomes `{ name?, status? }` with an at-least-one refine (mirrors `updateEventSchema`). `UpdateGroupInput` type updates accordingly.

- [ ] **Step 1: Write the failing schema tests**

Extend the `updateGroupSchema` describe block in
`src/lib/validation/group.test.ts` (Task A1 wrote the original three;
the "rejects an empty payload" case still passes via the new refine, and
"accepts a plain rename" still passes since `name` is now optional but
provided):

```ts
it("accepts a status-only archive", () => {
  expect(updateGroupSchema.safeParse({ status: "archived" }).success).toBe(true);
});

it("rejects an unknown status", () => {
  expect(updateGroupSchema.safeParse({ status: "deleted" }).success).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npx vitest run src/lib/validation/group.test.ts`
Expected: the two new cases FAIL (status not accepted yet).

- [ ] **Step 3: Prisma schema + migration**

In `prisma/schema.prisma`, next to `EventStatus`, add:

```prisma
enum GroupStatus {
  active
  archived

  @@map("group_status")
}
```

(match how `EventStatus` maps its name — copy its exact `@@map`
convention; check whether `EventStatus` uses one and mirror it), and in
`model Group` add:

```prisma
status GroupStatus @default(active)
```

Run: `npx prisma migrate dev --name add_group_status`
Expected: migration applies; `npx prisma generate` runs implicitly.
Existing rows get `active` via the default — no backfill.

- [ ] **Step 4: Update the Zod schema**

Replace Task A1's `updateGroupSchema` in `src/lib/validation/group.ts`:

```ts
export const groupStatusSchema = z.enum(["active", "archived"]);

// PATCH /api/account/groups/{groupId} — owner-only rename/archive/restore
// (spec 2026-08-06 features A + C). Mirrors updateEventSchema's
// at-least-one-field refine.
export const updateGroupSchema = z
  .object({
    name: z.string().trim().min(1, "Group name is required").optional(),
    status: groupStatusSchema.optional(),
  })
  .refine((data) => data.name !== undefined || data.status !== undefined, {
    message: "At least one field must be provided",
  });

export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
```

- [ ] **Step 5: Run tests to verify all pass**

Run: `npx vitest run src/lib/validation/group.test.ts`
Expected: PASS — including A1's originals (rename still parses; `{}`
still rejects, now via the refine).

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/validation/group.ts src/lib/validation/group.test.ts
git commit -m "migration: add group.status with archived state"
```

### Task C2: extend the account groups PATCH + `listUserGroups` ownership/status

**Files:**
- Modify: `src/app/api/account/groups/[groupId]/route.ts`
- Modify: `src/lib/account.ts` (listUserGroups)

**Interfaces:**
- Consumes: Task C1's schema; Part A's route (owner gate already in place).
- Produces: PATCH now also applies `status`; `listUserGroups` rows gain `status: "active" | "archived"` and `isOwner: boolean`. Task C5's UI consumes both.

- [ ] **Step 1: Apply `status` in the PATCH route**

In `src/app/api/account/groups/[groupId]/route.ts`, the owner gate and
validation are unchanged (C1's schema already accepts `status`). Replace
the update call:

```ts
const { name, status } = parsed.data;
const updated = await prisma.group.update({
  where: { id: groupId },
  data: {
    ...(name !== undefined && { name }),
    ...(status !== undefined && { status }),
  },
});

return NextResponse.json({ group: { id: updated.id, name: updated.name, status: updated.status } });
```

- [ ] **Step 2: Extend listUserGroups**

In `src/lib/account.ts`, `listUserGroups`: include each group's earliest
editor membership so ownership is decided in the same query (the
`getGroupOwner` rule — earliest editor membership — applied in bulk):

```ts
const memberships = await prisma.groupMembership.findMany({
  where: { userId },
  orderBy: { createdAt: "desc" },
  include: {
    group: {
      include: {
        _count: { select: { members: { where: { isActive: true } }, events: true } },
        memberships: {
          where: { role: "editor" },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { userId: true },
        },
      },
    },
  },
});

return memberships.map((membership) => ({
  groupId: membership.groupId,
  role: membership.role,
  name: membership.group.name,
  status: membership.group.status,
  isOwner: membership.group.memberships[0]?.userId === userId,
  memberCount: membership.group._count.members,
  eventCount: membership.group._count.events,
}));
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit` — expected clean (fix the `MyGroupsView`
`GroupSummary` interface only in Task C5; if tsc flags the page props
now, add `status`/`isOwner` to the interface in this task instead and
note it in the commit).

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/account/groups/[groupId]/route.ts" src/lib/account.ts
git commit -m "feat: owner-gated group archive/restore via the account groups PATCH"
```

### Task C3: gate archived groups at every entrance

**Files:**
- Modify: `src/lib/auth/require-session.ts`
- Modify: `src/app/g/[groupId]/route.ts` (token exchange)
- Modify: `src/app/api/account/groups/[groupId]/enter/route.ts`
- Create: `src/app/group-archived/page.tsx`

**Interfaces:**
- Consumes: `Group.status` (C1).
- Produces: `ArchivedGroupError extends SessionError` (status 403) exported from `require-session.ts`; `requireSession` throws it for any session on an archived group EXCEPT the owner's member-kind session; both entrance routes redirect to `/group-archived`; that page renders the explanation. Task C4 consumes `ArchivedGroupError` in the 8 group pages.

- [ ] **Step 1: requireSession gate**

In `src/lib/auth/require-session.ts`:

```ts
// Thrown instead of a plain SessionError so pages can send the visitor to
// the /group-archived explanation page rather than the landing page — the
// visitor had legitimate access, the group is just parked (spec 2026-08-06
// feature C). API routes need no special handling: it carries 403 like any
// SessionError.
export class ArchivedGroupError extends SessionError {
  constructor() {
    super(403, "This group has been archived by its owner");
  }
}
```

Then inside `requireSession`, pull group status in the SAME round trips
that already exist (no new query on the happy path):

- link branch: change the lookup to
  `prisma.groupShareLink.findUnique({ where: { id: payload.shareLinkId }, include: { group: { select: { status: true } } } })`
  and after the existing revocation check add:

```ts
if (link.group.status === "archived") {
  throw new ArchivedGroupError();
}
```

- member branch: extend the existing include —
  `include: { user: { select: { passwordChangedAt: true } }, group: { select: { status: true } } }` —
  and after the staleness check add:

```ts
if (membership.group.status === "archived") {
  // Owner exception: the owner keeps access to their archived group's
  // pages (Restore lives on /account/groups, but deep links they open
  // must not dead-end them). Owner = earliest editor membership, the
  // getGroupOwner rule. This extra query only runs on the archived path.
  const earliestEditor = await prisma.groupMembership.findFirst({
    where: { groupId: payload.groupId, role: "editor" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (earliestEditor?.userId !== payload.userId) {
    throw new ArchivedGroupError();
  }
}
```

- [ ] **Step 2: Token exchange gate**

In `src/app/g/[groupId]/route.ts`, change the link lookup to include the
group status:

```ts
const link = await prisma.groupShareLink.findUnique({
  where: { token },
  include: { group: { select: { status: true } } },
});
```

After the invalid/revoked check, before minting the session:

```ts
// An archived group's links stay valid but dormant (spec 2026-08-06
// feature C): no session is minted, and restore makes this same URL work
// again with no re-sharing.
if (link.group.status === "archived") {
  return NextResponse.redirect(new URL("/group-archived", request.url), { status: 303 });
}
```

- [ ] **Step 3: Enter-route gate**

In `src/app/api/account/groups/[groupId]/enter/route.ts`, after the
membership check, load the group's status and earliest editor in one
place:

```ts
const group = await prisma.group.findUnique({ where: { id: groupId }, select: { status: true } });
if (group?.status === "archived") {
  const earliestEditor = await prisma.groupMembership.findFirst({
    where: { groupId, role: "editor" },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  if (earliestEditor?.userId !== session.userId) {
    return NextResponse.redirect(new URL("/group-archived", request.url), { status: 303 });
  }
}
```

- [ ] **Step 4: The explanation page**

Create `src/app/group-archived/page.tsx` (server component, static copy,
same visual idiom as the empty states — cream bg, centered column):

```tsx
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

// Landing spot for anyone whose link or membership points at an archived
// group (spec 2026-08-06 feature C). Deliberately name-free: one static
// page covers every archived group, and the visitor's link already told
// them which group they were opening.
export default function GroupArchivedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center dark:bg-dark-bg">
      <Logo size={26} wordmarkClassName="text-base" />
      <h1 className="num mt-8 mb-2.5 text-2xl text-ink sm:text-[26px] dark:text-dark-text">
        This group has been archived
      </h1>
      <p className="mb-6 max-w-[380px] text-[14px] leading-relaxed text-muted dark:text-dark-muted">
        The group&apos;s owner has archived it, so it can&apos;t be opened right
        now. Your link stays valid — if the owner restores the group, the same
        link will work again.
      </p>
      <Link
        href="/"
        className="rounded-md bg-forest px-6 py-3.5 text-sm font-bold text-cream shadow-[0_8px_20px_-6px_rgba(22,58,46,0.5)] hover:bg-forest-hover dark:bg-dark-forest"
      >
        Back to home
      </Link>
    </div>
  );
}
```

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit` — expected clean.

```bash
git add src/lib/auth/require-session.ts "src/app/g/[groupId]/route.ts" "src/app/api/account/groups/[groupId]/enter/route.ts" src/app/group-archived/page.tsx
git commit -m "feat: gate archived groups at session validation and both entrances"
```

### Task C4: route the 8 group pages to the explanation page

**Files:**
- Modify (identical two-line change in each):
  - `src/app/g/[groupId]/events/page.tsx`
  - `src/app/g/[groupId]/members/[memberId]/expenses/page.tsx`
  - `src/app/g/[groupId]/members/[memberId]/balance/page.tsx`
  - `src/app/g/[groupId]/events/[eventId]/page.tsx`
  - `src/app/g/[groupId]/events/[eventId]/bills/new/page.tsx`
  - `src/app/g/[groupId]/events/[eventId]/bills/[billId]/edit/page.tsx`
  - `src/app/g/[groupId]/events/[eventId]/settle/page.tsx`
  - `src/app/g/[groupId]/events/[eventId]/members/[memberId]/page.tsx`

**Interfaces:**
- Consumes: `ArchivedGroupError` (Task C3).

- [ ] **Step 1: Update each page's catch**

Every one of the 8 pages has this exact pattern:

```ts
} catch (error) {
  if (error instanceof SessionError) redirect("/");
  throw error;
}
```

Change to (and extend the import from `@/lib/auth/require-session`):

```ts
} catch (error) {
  if (error instanceof ArchivedGroupError) redirect("/group-archived");
  if (error instanceof SessionError) redirect("/");
  throw error;
}
```

Order matters — `ArchivedGroupError` IS a `SessionError`, so its check
must come first.

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit` — expected clean.

```bash
git add "src/app/g/[groupId]"
git commit -m "feat: send sessions on archived groups to the explanation page"
```

### Task C5: archive/restore UI in MyGroupsView

**Files:**
- Create: `src/components/group/ArchiveGroupModal.tsx`
- Modify: `src/components/account/MyGroupsView.tsx`

**Interfaces:**
- Consumes: `listUserGroups`' `status` + `isOwner` (C2), PATCH with `status` (C2).
- Produces: owner-only Archive/Restore menu items; collapsed "Archived (N)" section; `ArchiveGroupModal({ group, onClose, onArchived })`.

- [ ] **Step 1: ArchiveGroupModal**

`src/components/group/ArchiveGroupModal.tsx` — same shell as
`ArchiveEventModal` (Part B), group copy:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface ArchiveGroupModalProps {
  group: { groupId: string; name: string };
  onClose: () => void;
  onArchived: () => void;
}

// Owner-only (server-enforced). Copy leads with the consequence that
// matters: every share link goes dormant until restore.
export function ArchiveGroupModal({ group, onClose, onArchived }: ArchiveGroupModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/account/groups/${group.groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      if (!res.ok) throw new Error("archive failed");
      onArchived();
    } catch {
      setError("Couldn't archive — check your connection and try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/35" onClick={onClose} />
      <div className="relative w-full max-w-[400px] rounded-t-xl bg-white p-7 shadow-[0_30px_60px_-20px_rgba(19,46,40,0.35)] sm:rounded-lg dark:bg-dark-card">
        <h2 className="num mb-2.5 text-xl text-ink sm:text-[22px] dark:text-dark-text">
          Archive {group.name}?
        </h2>
        <p className="mb-5 text-[13px] leading-relaxed text-muted dark:text-dark-muted">
          Everyone&apos;s share links stop working while the group is archived —
          visitors see an &ldquo;archived by its owner&rdquo; notice instead.
          Restore the group any time and the same links work again. Nothing is
          deleted.
        </p>

        {error && <p className="mb-3 text-xs text-coral">{error}</p>}

        <div className="flex gap-2.5">
          <Button variant="secondary" className="flex-1 text-center" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={submitting} onClick={handleArchive} className="flex-1 text-center">
            Archive group
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: MyGroupsView changes**

1. `GroupSummary` gains `status: "active" | "archived"; isOwner: boolean;`
   (also mirror on the page's prop type if it re-declares it — check
   `src/app/account/groups/page.tsx`).
2. Partition like the events list: `activeGroups` / `archivedGroups`,
   `const [showArchived, setShowArchived] = useState(false)`, header
   count uses `activeGroups.length`, empty state only when both empty.
   Collapsed section markup mirrors Part B Task B3's (same classNames,
   label "Archived (N)").
3. Menu items in `GroupCard` (extending Part A's menu; add `Archive,
   ArchiveRestore` to the lucide import): Rename stays for everyone
   (server 403s non-owners); Archive/Restore render only when
   `group.isOwner`:

```tsx
onAction={(key: Key) => {
  if (key === "rename") onRequestRename(group);
  if (key === "archive") onRequestArchive(group);
  if (key === "restore") handleRestore();
}}
```

```tsx
{group.isOwner && group.status === "active" && (
  <MenuItem id="archive" className={/* same classes as Rename */}>
    <Archive className="h-3.5 w-3.5" aria-hidden="true" /> Archive
  </MenuItem>
)}
{group.isOwner && group.status === "archived" && (
  <MenuItem id="restore" className={/* same classes */}>
    <ArchiveRestore className="h-3.5 w-3.5" aria-hidden="true" /> Restore
  </MenuItem>
)}
```

with `handleRestore` in `GroupCard` PATCHing `{ status: "active" }` to
`/api/account/groups/${group.groupId}` then `router.refresh()` (add
`useRouter` inside `GroupCard`).

4. On archived cards, disable the enter-group form's navigation for
   non-owners? No — simpler and consistent: leave the card clickable;
   the enter route (C3) redirects non-owners to `/group-archived`, and
   the owner passes through. Add the gold "Archived" pill (copy the
   `isArchived` pill markup from `EventCard`) to the card's name row when
   `group.status === "archived"`.
5. Render `ArchiveGroupModal` beside the rename modal with
   `archiveTarget` state, `onArchived` → clear + `router.refresh()`.

- [ ] **Step 3: Hand-verify the full role matrix**

Dev server up, two browser contexts (owner logged in; second context for
links / a non-owner member):
1. Owner archives a group → moves to collapsed Archived section with
   pill; restore brings it back.
2. Non-owner registered member's groups list: shows the archived group
   but NO Archive/Restore items; clicking the card → `/group-archived`.
3. Editor/viewer share link of an archived group → `/group-archived`
   explanation page, no session cookie minted (check devtools).
4. A visitor who ALREADY had a session cookie before archiving → any
   group page now redirects to `/group-archived` (requireSession gate).
5. Owner deep-links into the archived group's events page → still works
   (owner exception).
6. Restore → the SAME share link from step 3 now opens the group.
7. Direct PATCH `{ status: "archived" }` as non-owner → 403.

- [ ] **Step 4: Commit, push, PR**

```bash
git add src/components/group/ArchiveGroupModal.tsx src/components/account/MyGroupsView.tsx src/app/account/groups/page.tsx
git commit -m "feat: owner archive and restore for groups on the My Groups page"
git push -u origin archived-groups
```

PR via writing-pull-requests skill (call out the migration in the
Summary callout: `npx prisma migrate deploy` before this branch serves
traffic).

---

# Part D — Settle acknowledgment (branch `settle-confirm-acknowledgment`)

### Task D1: real-world-payment checkbox gate in ConfirmSettleModal

**Files:**
- Modify: `src/components/settle/SettleUpFlow.tsx` (ConfirmSettleModal, ~line 326)

**Interfaces:**
- Consumes: nothing new — client-only change; `POST /api/events/{id}/settlement/confirm` untouched (rule 10 / spec feature D).

- [ ] **Step 1: Add the checkbox state and gate**

`ConfirmSettleModal` is conditionally rendered (`{showConfirm && ...}`),
so it unmounts on close — a local `useState(false)` resets on every
open with no extra effect needed. Inside `ConfirmSettleModal`:

```tsx
const [acknowledged, setAcknowledged] = useState(false);
```

(add `useState` to the component file's existing react import if the
modal doesn't already close over one).

Change the lead-in copy: replace the current

```tsx
<h2 ...>Mark these {transfers.length} transfer{...} as settled?</h2>
```

sub-copy flow so the list reads as a checklist to verify. Keep the `h2`,
and insert directly under it, above the transfer list:

```tsx
<p className="mb-3 text-[12.5px] leading-relaxed text-muted dark:text-dark-muted">
  Check that each of these payments has actually been made:
</p>
```

Above the buttons (replacing nothing — the existing can't-be-undone
paragraph stays), insert:

```tsx
<label className="mb-5 flex cursor-pointer items-start gap-2.5 rounded-md bg-cream px-3.5 py-3 dark:bg-dark-bg">
  <input
    type="checkbox"
    checked={acknowledged}
    onChange={(e) => setAcknowledged(e.target.checked)}
    className="mt-0.5 h-4 w-4 shrink-0 accent-forest"
  />
  <span className="text-[13px] font-semibold text-ink dark:text-dark-text">
    These payments have been made in real life
  </span>
</label>
```

(adjust the existing can't-be-undone `<p>`'s `mb-5` to `mb-3` so the
spacing lands on the checkbox block).

Gate the confirm button:

```tsx
disabled={confirming || !acknowledged}
```

- [ ] **Step 2: Hand-verify**

Dev server: run a settle-up as an editor.
1. Modal opens with checkbox unticked and "Yes, mark as settled"
   disabled (visibly, via the existing `disabled:opacity-60`).
2. Tick → button enables; confirm works end-to-end.
3. Cancel, reopen → checkbox is unticked again.
4. Viewer role: still never sees the confirm button (unchanged).

- [ ] **Step 3: Commit, push, PR**

```bash
git add src/components/settle/SettleUpFlow.tsx
git commit -m "feat: require a real-world payment acknowledgment before settling"
git push -u origin settle-confirm-acknowledgment
```

PR via writing-pull-requests skill.

---

## Self-review notes (already applied)

- Spec coverage: A→A1-A3, B→B1-B3 (incl. warn-but-allow copy with count
  AND amount), C→C1-C5 (migration, both entrances, every-request gate,
  owner exception, explanation page, same-link restore), D→D1. The
  spec's "getMemberEventActivity stays unfiltered" interpretation is
  recorded in B1.
- Type consistency: `updateGroupSchema` evolves A1→C1 with tests
  guarding both shapes; `EventSummary.unsettledCount` produced in B1,
  consumed in B2; `ArchivedGroupError` produced in C3, consumed in C4;
  `listUserGroups.isOwner/status` produced in C2, consumed in C5.
- Known checks for the implementer: `requireUserSession`'s throw type
  (A2), react-aria conditional MenuItem children (B2), `EventStatus`
  `@@map` convention (C1), page-level prop re-declarations (C2/C5).
