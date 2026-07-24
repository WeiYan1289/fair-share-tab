# Link-Only Access Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a share link the only thing that grants access — remove the
localStorage-driven join/claim/identity/personalization layer, drop the
per-viewer "you" marker everywhere, simplify the landing page to a single
view, and add a one-time "save this link" reminder so people don't lose
their way back in now that nothing is cached client-side.

**Architecture:** No change to the existing token → httpOnly session cookie
exchange (`GET /g/{token}`) or to `requireSession()` — that mechanism already
satisfies "purely controlled by the link." This refactor only removes the
`src/lib/device-identity.ts` localStorage layer built on top of it (join
screen, claim endpoint, group switcher, returning-device landing, per-viewer
"you" markers) and adds one small new piece: a one-time query param carried
through the token-exchange redirect that powers a dismissible "save this
link" banner.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Prisma, Zod, Tailwind CSS.

## Global Constraints

- Money/settlement/currency logic is untouched — do not modify
  `src/lib/settlement/*`, `src/lib/currency.ts`, or `src/lib/format.ts`.
- CLAUDE.md rule 8: share tokens must never sit persistently in the address
  bar. The one exception introduced here (`?savelink={token}`) must be
  stripped from the URL via `router.replace` in the same render pass it's
  read — never left in place.
- CLAUDE.md rule 9: `viewer` role must stay enforced server-side; nothing in
  this plan touches server-side role checks — only client-side "who am I"
  personalization is being removed.
- This codebase's test suite (Vitest) only covers pure `src/lib/*` modules
  (settlement, currency, format, validation schemas) — there is no
  component-test or route-test infrastructure. Follow that existing pattern:
  verify UI/routing changes with `npx tsc --noEmit`, `npm run lint`, and a
  manual browser pass, not new component tests. Do not introduce a new test
  framework as part of this plan.
- Every deleted file must have zero remaining imports afterward — grep for
  the deleted symbol/path before committing each task.
- Follow the repo's commit convention (Conventional Commits prefix, e.g.
  `refactor:`/`feat:`/`docs:`) and do not add a `Co-Authored-By: Claude`
  trailer (standing project rule).

---

### Task 1: Token exchange lands directly in the group, carrying a one-time save-link token

**Files:**
- Modify: `src/app/g/[groupId]/route.ts`

**Interfaces:**
- Produces: the redirect destination `/g/{groupId}/events?savelink={token}` —
  Task 7 (`EventsListView`) reads the `savelink` search param by this exact
  name.

- [ ] **Step 1: Change the redirect target and comment**

Replace the whole file with:

```ts
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getClientIp, isRateLimited } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS, signSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

// This route matches GET /g/{token} (system-design.md §3.2) — the segment
// holds a raw share token here, not a group id, even though the folder is
// named [groupId] to match every nested page under it (/g/[groupId]/events,
// ...). Next.js requires one dynamic segment name per route-tree position,
// so this top-level handler and its siblings share the folder; only this
// handler's value is actually a token.
export async function GET(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId: token } = await params;

  const ip = getClientIp(request);
  if (isRateLimited(`token-lookup:${ip}`)) {
    return new NextResponse("Too many attempts. Please try again in a minute.", { status: 429 });
  }

  const link = await prisma.groupShareLink.findUnique({ where: { token } });

  // Same response for "never existed" and "revoked" — copy stays generic on
  // purpose (Screen Spec P2-05).
  if (!link || link.revokedAt !== null) {
    return new NextResponse("This link is invalid or has been revoked.", {
      status: 404,
      headers: { "X-Robots-Tag": "noindex" },
    });
  }

  const session = signSession({ groupId: link.groupId, role: link.role, shareLinkId: link.id });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session, SESSION_COOKIE_OPTIONS);

  // Access is granted purely by the cookie above — there's no separate
  // identity step to land on first. `savelink` carries the token forward
  // exactly one hop so the events list can offer a one-time "save this
  // link" reminder; it reads the param and strips it from the URL in the
  // same render pass (CLAUDE.md rule 8 — the token must never sit
  // persistently in the address bar).
  const destination = new URL(`/g/${link.groupId}/events?savelink=${token}`, request.url);
  return NextResponse.redirect(destination, { status: 303 });
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`, create a group, copy its editor link from the Share
dialog, open it in an incognito window. Confirm you land on
`/g/{groupId}/events` and the address bar briefly shows `?savelink=...`
before Task 7 strips it (it's fine if it still shows at this step — Task 7
is what removes it; for now just confirm the redirect lands on the events
list and the app still works).

- [ ] **Step 4: Commit**

```bash
git add src/app/g/\[groupId\]/route.ts
git commit -m "refactor: land directly on the events list after opening a link"
```

---

### Task 2: Remove the join screen and claim endpoint

**Files:**
- Delete: `src/app/g/[groupId]/join/page.tsx`
- Delete: `src/components/join/JoinScreen.tsx`
- Delete: `src/app/api/groups/[id]/claim/route.ts`
- Modify: `src/lib/validation/group.ts`

**Interfaces:**
- Consumes: none from other tasks.
- Produces: `src/lib/validation/group.ts` no longer exports
  `claimMemberSchema` or `ClaimMemberInput` — confirmed via grep that no
  other file (including `group.test.ts`) references them, so nothing else
  needs updating.

- [ ] **Step 1: Delete the join page and its directory**

```bash
git rm src/app/g/\[groupId\]/join/page.tsx
rmdir "src/app/g/[groupId]/join" 2>/dev/null || true
```

- [ ] **Step 2: Delete JoinScreen and its now-empty directory**

```bash
git rm src/components/join/JoinScreen.tsx
rmdir src/components/join 2>/dev/null || true
```

- [ ] **Step 3: Delete the claim API route and its now-empty directories**

```bash
git rm src/app/api/groups/\[id\]/claim/route.ts
rmdir "src/app/api/groups/[id]/claim" 2>/dev/null || true
```

- [ ] **Step 4: Remove the claim schema from validation**

In `src/lib/validation/group.ts`, remove the `claimMemberSchema` block so the
file reads:

```ts
import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
  creatorName: z.string().trim().min(1, "Your name is required"),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

export const shareLinkRoleSchema = z.enum(["editor", "viewer"]);

export const regenerateLinkSchema = z.object({
  role: shareLinkRoleSchema,
});

export type RegenerateLinkInput = z.infer<typeof regenerateLinkSchema>;
```

- [ ] **Step 5: Confirm nothing else references the removed symbols**

Run: `grep -rn "JoinScreen\|claimMemberSchema\|ClaimMemberInput\|groups/\[id\]/claim" src/`
Expected: no output.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add -A -- src/app/g/\[groupId\]/join src/components/join src/app/api/groups/\[id\]/claim src/lib/validation/group.ts
git commit -m "refactor: remove the join screen and member-claim endpoint"
```

---

### Task 3: Delete the personalization layer's dead components; simplify the landing page and group header

**Files:**
- Delete: `src/components/group/GroupSwitcher.tsx`
- Delete: `src/components/landing/ReturningDeviceLanding.tsx`
- Delete: `src/components/landing/LandingGate.tsx`
- Rename: `src/components/landing/ColdVisitorLanding.tsx` → `src/components/landing/Landing.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/group/CreateGroupModal.tsx`
- Modify: `src/components/group/GroupHeader.tsx`
- Modify: `src/components/events/EventDashboard.tsx:89`
- Modify: `src/components/events/EventsListView.tsx:34`

**Interfaces:**
- Produces: `Landing` component (named export `export function Landing()`),
  imported by `src/app/page.tsx`. `GroupHeader` now takes only
  `{ groupName: string }` — no `groupId` prop; no other task depends on
  these files.

Note: `GroupHeader.tsx` imports `GroupSwitcher` today, so deleting
`GroupSwitcher.tsx` and rewriting `GroupHeader.tsx` must land in the same
task/commit — doing them separately would leave a broken import in between,
which a reviewer couldn't approve in isolation.

**Do NOT delete `src/lib/device-identity.ts` in this task.** It is still
imported by `BillForm.tsx`, `SettleUpFlow.tsx`, and `EventDashboard.tsx` (for
the "you" marker, removed in Tasks 4-6) — deleting it here would break the
build until those later tasks land. `device-identity.ts` itself is deleted
at the end of Task 6, once its last consumer (`SettleUpFlow.tsx`) is
removed. This task only deletes the three components above (whose sole
purpose was reading `device-identity.ts` for personalization/switching, not
the "you" marker) plus renames `ColdVisitorLanding.tsx`.

- [ ] **Step 1: Delete the personalization files**

```bash
git rm src/components/group/GroupSwitcher.tsx
git rm src/components/landing/ReturningDeviceLanding.tsx
git rm src/components/landing/LandingGate.tsx
```

(`src/lib/device-identity.ts` is NOT deleted here — see the note above. It's
deleted at the end of Task 6.)

- [ ] **Step 2: Rename ColdVisitorLanding to Landing and drop the "cold visitor" framing**

```bash
git mv src/components/landing/ColdVisitorLanding.tsx src/components/landing/Landing.tsx
```

Edit `src/components/landing/Landing.tsx`: rename the function and its
doc comment (the rest of the file — hero markup, `PasteLinkPanel`,
`CreateGroupModal` usage — stays identical):

```tsx
// Screen Spec P1-01. The only landing view — shown to every visitor
// regardless of device history, since access is granted purely by opening a
// group's link. Kept to a single, uncluttered hero moment -- the
// step-by-step explainer and the no-password disclosure live on /tutorial
// instead, one quiet link away.
export function Landing() {
```

(replacing the existing `export function ColdVisitorLanding() {` line and
its preceding comment block).

- [ ] **Step 3: Render Landing directly from the root page**

Replace `src/app/page.tsx` with:

```tsx
import { Landing } from "@/components/landing/Landing";

export default function Home() {
  return <Landing />;
}
```

- [ ] **Step 4: Stop saving a device identity on group creation**

In `src/components/group/CreateGroupModal.tsx`, remove the import on line 6
(`import { saveDeviceIdentity } from "@/lib/device-identity";`) and remove
the `saveDeviceIdentity({...})` call, so `handleCreate` reads:

```tsx
  async function handleCreate() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          creatorName: yourName.trim(),
        }),
      });
      if (!res.ok) throw new Error("create failed");
      const data = await res.json();

      window.location.href = `/g/${data.group.id}/events`;
    } catch {
      setError("Couldn't create the group — check your connection and try again.");
      setSubmitting(false);
    }
  }
```

- [ ] **Step 5: Rewrite GroupHeader**

Replace `src/components/group/GroupHeader.tsx` with:

```tsx
"use client";

import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface GroupHeaderProps {
  groupName: string;
}

// Shared nav header for every in-group screen (P3-02, P4-01, etc.): logo,
// group name, theme toggle. No per-viewer identity is tracked (CLAUDE.md
// rule 5) and there's no device-scoped group switcher anymore (access is
// purely link-driven), so there's nothing else to render here.
export function GroupHeader({ groupName }: GroupHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between sm:mb-[26px]">
      <Logo size={26} wordmarkClassName="text-base sm:text-[17px]" />
      <span className="text-[13.5px] font-bold text-ink dark:text-dark-text">{groupName}</span>
      <ThemeToggle />
    </div>
  );
}
```

- [ ] **Step 6: Update EventDashboard's call site**

In `src/components/events/EventDashboard.tsx:89`, change:

```tsx
        <GroupHeader groupId={groupId} groupName={groupName} />
```

to:

```tsx
        <GroupHeader groupName={groupName} />
```

- [ ] **Step 7: Update EventsListView's call site**

In `src/components/events/EventsListView.tsx:34`, change:

```tsx
        <GroupHeader groupId={groupId} groupName={groupName} />
```

to:

```tsx
        <GroupHeader groupName={groupName} />
```

- [ ] **Step 8: Confirm no stale references**

Run: `grep -rn "GroupHeader groupId=\|GroupSwitcher\|ReturningDeviceLanding\|LandingGate\|ColdVisitorLanding" src/`
Expected: no output. (Do NOT grep for bare `device-identity` here — it is
still legitimately imported by `BillForm.tsx`, `SettleUpFlow.tsx`, and
`EventDashboard.tsx` until Tasks 4-6 remove those usages; that file itself
is untouched by this task.)

- [ ] **Step 9: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add -A -- src/components/group/GroupSwitcher.tsx \
  src/components/landing/ReturningDeviceLanding.tsx src/components/landing/LandingGate.tsx \
  src/components/landing/ColdVisitorLanding.tsx src/components/landing/Landing.tsx \
  src/app/page.tsx src/components/group/CreateGroupModal.tsx src/components/group/GroupHeader.tsx \
  src/components/events/EventDashboard.tsx src/components/events/EventsListView.tsx
git commit -m "refactor: remove localStorage personalization; simplify landing page and header"
```

---

### Task 4: Remove the "you" marker from MemberChip and EventDashboard

**Files:**
- Modify: `src/components/members/MemberChip.tsx`
- Modify: `src/components/events/EventDashboard.tsx`

**Interfaces:**
- Produces: `MemberChip` no longer has an `isYou` prop. Any future caller
  must not pass it.

- [ ] **Step 1: Remove `isYou` from MemberChip's props and rendering**

In `src/components/members/MemberChip.tsx`:
- Remove `isYou: boolean;` from the `MemberChipProps` interface.
- Remove `isYou,` from the destructured props.
- In the mobile avatar (`<InitialsAvatar name={member.name} color={member.avatarColor} size={34} className={cn(isYou && "ring-2 ring-mint ring-offset-0")} />`), remove the `className` prop entirely (no ring to apply).
- In the desktop avatar, same: remove the `className={cn(isYou && "ring-2 ring-mint ring-offset-0")}` prop.
- Remove the `{isYou && (<span className="rounded-full bg-mint-tint ...">you</span>)}` block from the name button, so it reads:

```tsx
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => canEdit && setRenaming(true)}
              className="flex items-center gap-1.5 text-left text-[13.5px] font-bold text-ink dark:text-dark-text"
            >
              {member.name}
              {canEdit && <span className="text-[11px] text-muted-2">✎</span>}
            </button>
```

Update the doc comment above the component (currently references CLAUDE.md
rule 5's "you" marker) to:

```tsx
// Screen Spec P4-01 member chip + P4-04 inline rename / deactivated states.
// No per-viewer identity is tracked (CLAUDE.md rule 5) -- every member
// renders identically for anyone with the link. Renders two layouts sharing
// the same rename/press-hold state: a compact vertical card in a single
// horizontally-scrolling row on mobile (P4-01's mobile mock -- members
// never wrap to a second row there), and the wider horizontal chip that
// wraps normally on sm+ (the desktop mock).
```

- [ ] **Step 2: Remove viewerMemberId from EventDashboard**

In `src/components/events/EventDashboard.tsx`:
- Remove the import `getDeviceIdentities` (line 13).
- Remove `const [viewerMemberId, setViewerMemberId] = useState<string | null>(null);` (line 61).
- Remove the `useEffect` that reads `getDeviceIdentities()` (lines 70-73).
- In the `<MemberChip>` usage, remove the `isYou={member.id === viewerMemberId}` prop, so the call reads:

```tsx
            <MemberChip
              key={member.id}
              member={member}
              currency={event.currency}
              canEdit={canEdit}
              onRenamed={handleRename}
              onRequestDeactivate={(id, name) => setDeactivateTarget({ id, name })}
              onReactivated={() => router.refresh()}
            />
```

- [ ] **Step 3: Confirm no stale references**

Run: `grep -n "isYou\|viewerMemberId\|getDeviceIdentities" src/components/members/MemberChip.tsx src/components/events/EventDashboard.tsx`
Expected: no output.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/members/MemberChip.tsx src/components/events/EventDashboard.tsx
git commit -m "refactor: drop the per-viewer you marker from member chips"
```

---

### Task 5: Remove the "you" marker from BillForm

**Files:**
- Modify: `src/components/bills/BillForm.tsx`

- [ ] **Step 1: Remove the device-identity import and viewerMemberId state**

Remove `import { getDeviceIdentities } from "@/lib/device-identity";` (line
10) and this block from `EditableBillForm` (lines 73-77):

```tsx
  const [viewerMemberId, setViewerMemberId] = useState<string | null>(null);
  useEffect(() => {
    const identity = getDeviceIdentities().find((entry) => entry.groupId === groupId);
    setViewerMemberId(identity?.memberId ?? null);
  }, [groupId]);

```

(Leave the `useEffect`/`useState` React imports in place — they're still
used elsewhere in the file.)

- [ ] **Step 2: Drop `isYou` from the "Paid by" and "Split between" chip lists**

In both `MemberSelectChip` usages inside `EditableBillForm` (the "Paid by"
loop and the "Split between" loop), remove the `isYou={m.id === viewerMemberId}`
prop:

```tsx
            {activeMembers.map((m) => (
              <MemberSelectChip
                key={m.id}
                member={m}
                selected={payerId === m.id}
                onClick={() => setPayerId(m.id)}
              />
            ))}
```

and

```tsx
            {activeMembers.map((m) => (
              <MemberSelectChip
                key={m.id}
                member={m}
                selected={splitBetween.has(m.id)}
                onClick={() => toggleParticipant(m.id)}
              />
            ))}
```

- [ ] **Step 3: Remove the inline "you" chip from the equal-split summary list**

In the equal-split rendering block, change:

```tsx
                    <span className="text-[13.5px] text-ink dark:text-dark-text">
                      {member.name}
                      {id === viewerMemberId && (
                        <span className="ml-1.5 rounded-full bg-mint-tint px-[6px] py-px text-[9px] font-extrabold text-emerald dark:bg-mint/16 dark:text-mint">
                          you
                        </span>
                      )}
                    </span>
```

to:

```tsx
                    <span className="text-[13.5px] text-ink dark:text-dark-text">
                      {member.name}
                    </span>
```

- [ ] **Step 4: Remove the `isYou` prop from `MemberSelectChip` itself**

Change the function signature and body from:

```tsx
function MemberSelectChip({
  member,
  selected,
  isYou,
  onClick,
}: {
  member: FormMember;
  selected: boolean;
  isYou: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border-[1.5px] py-1.5 pr-3.5 pl-1.5",
        selected
          ? "border-forest bg-mint-tint text-forest dark:border-mint dark:bg-mint/16 dark:text-mint"
          : "border-ink/14 bg-white text-muted dark:border-white/14 dark:bg-dark-card dark:text-dark-muted",
      )}
    >
      <InitialsAvatar name={member.name} color={member.avatarColor} size={24} />
      <span className="text-[13px] font-bold">
        {member.name}
        {isYou && (
          <span
            className={cn(
              "ml-1.5 rounded-full px-[6px] py-px text-[9px] font-extrabold",
              selected
                ? "bg-forest text-cream dark:bg-mint dark:text-dark-bg"
                : "bg-cream text-muted-2 dark:bg-dark-bg dark:text-dark-muted",
            )}
          >
            you
          </span>
        )}
      </span>
    </button>
  );
}
```

to:

```tsx
function MemberSelectChip({
  member,
  selected,
  onClick,
}: {
  member: FormMember;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border-[1.5px] py-1.5 pr-3.5 pl-1.5",
        selected
          ? "border-forest bg-mint-tint text-forest dark:border-mint dark:bg-mint/16 dark:text-mint"
          : "border-ink/14 bg-white text-muted dark:border-white/14 dark:bg-dark-card dark:text-dark-muted",
      )}
    >
      <InitialsAvatar name={member.name} color={member.avatarColor} size={24} />
      <span className="text-[13px] font-bold">{member.name}</span>
    </button>
  );
}
```

- [ ] **Step 5: Confirm no stale references**

Run: `grep -n "isYou\|viewerMemberId\|getDeviceIdentities" src/components/bills/BillForm.tsx`
Expected: no output.

- [ ] **Step 6: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/bills/BillForm.tsx
git commit -m "refactor: drop the per-viewer you marker from the bill form"
```

---

### Task 6: Remove the "you" marker from SettleUpFlow and TransferGraph, and delete device-identity.ts

**Files:**
- Modify: `src/components/settle/SettleUpFlow.tsx`
- Modify: `src/components/settle/TransferGraph.tsx`
- Delete: `src/lib/device-identity.ts`

**Interfaces:**
- Produces: `TransferGraph` no longer takes a `viewerMemberId` prop.
  `src/lib/device-identity.ts` no longer exists anywhere in the codebase
  after this task.

Note: `src/lib/device-identity.ts` is deleted here, not in Task 3, because
`SettleUpFlow.tsx` (this task) is its last remaining consumer — Task 3
already removed the other consumers that only used it for personalization
(`GroupSwitcher`, `ReturningDeviceLanding`, `LandingGate`, `CreateGroupModal`),
and Tasks 4-5 removed `EventDashboard.tsx`'s and `BillForm.tsx`'s "you"-marker
usages. Once Step 1 below removes `SettleUpFlow.tsx`'s usage, nothing
imports it anymore.

- [ ] **Step 1: Remove viewerMemberId from SettleUpFlow**

In `src/components/settle/SettleUpFlow.tsx`:
- Remove `import { getDeviceIdentities } from "@/lib/device-identity";` (line 7).
- Remove `const [viewerMemberId, setViewerMemberId] = useState<string | null>(null);` (line 63).
- Remove the `useEffect` reading `getDeviceIdentities()` (lines 65-68).
- In the `<TransferGraph>` usage, remove the `viewerMemberId={viewerMemberId}` prop, so it reads:

```tsx
        <TransferGraph
          transfers={transfers}
          members={members}
          currency={currency}
        />
```

- [ ] **Step 2: Remove viewerMemberId from TransferGraph's props**

In `src/components/settle/TransferGraph.tsx`, change the interface and
function signature from:

```tsx
interface TransferGraphProps {
  transfers: Transfer[];
  members: SettleMember[];
  currency: string;
  viewerMemberId: string | null;
}
```
```tsx
export function TransferGraph({ transfers, members, currency, viewerMemberId }: TransferGraphProps) {
```

to:

```tsx
interface TransferGraphProps {
  transfers: Transfer[];
  members: SettleMember[];
  currency: string;
}
```
```tsx
export function TransferGraph({ transfers, members, currency }: TransferGraphProps) {
```

- [ ] **Step 3: Remove `isYou` from the desktop graph nodes**

Change both `debtorIds.map`/`creditorIds.map` blocks from:

```tsx
            <GraphNode
              key={id}
              member={memberById.get(id)}
              isYou={id === viewerMemberId}
              setRef={(el) => {
                if (el) nodeRefs.current.set(id, el);
              }}
            />
```

to:

```tsx
            <GraphNode
              key={id}
              member={memberById.get(id)}
              setRef={(el) => {
                if (el) nodeRefs.current.set(id, el);
              }}
            />
```

(applies to both the debtor column and the creditor column).

- [ ] **Step 4: Remove `isYou` from the mobile transfer card list**

Change:

```tsx
                <TransferEndpoint member={from} isYou={t.fromMemberId === viewerMemberId} />
```
and
```tsx
                <TransferEndpoint member={to} isYou={t.toMemberId === viewerMemberId} />
```

to:

```tsx
                <TransferEndpoint member={from} />
```
and
```tsx
                <TransferEndpoint member={to} />
```

- [ ] **Step 5: Simplify GraphNode**

Change:

```tsx
function GraphNode({
  member,
  isYou,
  setRef,
}: {
  member: SettleMember | undefined;
  isYou: boolean;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  if (!member) return null;
  return (
    <div ref={setRef} className="flex flex-col items-center gap-1.5" style={{ width: 130 }}>
      <InitialsAvatar
        name={member.name}
        color={member.avatarColor}
        size={NODE_SIZE}
        className={cn(
          "text-[19px] shadow-[0_10px_22px_-8px_rgba(19,46,40,0.35)]",
          isYou && "ring-4 ring-mint-tint dark:ring-mint/18",
        )}
      />
      <p className="text-center text-[13px] font-bold text-ink dark:text-dark-text">
        {member.name}
        {isYou && (
          <>
            <br />
            <span className="rounded-full bg-mint-tint px-[7px] py-px text-[9.5px] font-extrabold text-emerald dark:bg-mint/16 dark:text-mint">
              you
            </span>
          </>
        )}
      </p>
    </div>
  );
}
```

to:

```tsx
function GraphNode({
  member,
  setRef,
}: {
  member: SettleMember | undefined;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  if (!member) return null;
  return (
    <div ref={setRef} className="flex flex-col items-center gap-1.5" style={{ width: 130 }}>
      <InitialsAvatar
        name={member.name}
        color={member.avatarColor}
        size={NODE_SIZE}
        className="text-[19px] shadow-[0_10px_22px_-8px_rgba(19,46,40,0.35)]"
      />
      <p className="text-center text-[13px] font-bold text-ink dark:text-dark-text">
        {member.name}
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Simplify TransferEndpoint**

Change:

```tsx
function TransferEndpoint({ member, isYou }: { member: SettleMember | undefined; isYou: boolean }) {
  if (!member) return null;
  return (
    <div className="flex w-[66px] flex-col items-center gap-1.5">
      <InitialsAvatar
        name={member.name}
        color={member.avatarColor}
        size={34}
        className={cn(isYou && "ring-2 ring-mint")}
      />
      <p className="text-center text-[10.5px] font-bold text-ink">{member.name}</p>
      {isYou && (
        <span className="rounded-full bg-mint-tint px-[5px] py-px text-[8px] font-extrabold text-emerald">
          you
        </span>
      )}
    </div>
  );
}
```

to:

```tsx
function TransferEndpoint({ member }: { member: SettleMember | undefined }) {
  if (!member) return null;
  return (
    <div className="flex w-[66px] flex-col items-center gap-1.5">
      <InitialsAvatar name={member.name} color={member.avatarColor} size={34} />
      <p className="text-center text-[10.5px] font-bold text-ink">{member.name}</p>
    </div>
  );
}
```

- [ ] **Step 7: Confirm no stale references, then delete device-identity.ts**

Run: `grep -n "isYou\|viewerMemberId\|getDeviceIdentities" src/components/settle/SettleUpFlow.tsx src/components/settle/TransferGraph.tsx`
Expected: no output.

Then confirm `src/lib/device-identity.ts` has zero remaining importers
anywhere in the codebase (Tasks 3-5 already removed every other consumer;
this task's Step 1 just removed the last one):

Run: `grep -rln "device-identity" src/ | grep -v "^src/lib/device-identity.ts$"`
Expected: no output.

Delete the file:

```bash
git rm src/lib/device-identity.ts
```

- [ ] **Step 8: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`cn` may become an unused import in `TransferGraph.tsx`
if no other `cn(...)` calls remain in that file — check with
`grep -n "cn(" src/components/settle/TransferGraph.tsx`; if the only
remaining usage was the ones just removed, also remove the
`import { cn } from "@/lib/cn";` line to keep lint clean.)

- [ ] **Step 9: Commit**

```bash
git add -A -- src/components/settle/SettleUpFlow.tsx src/components/settle/TransferGraph.tsx \
  src/lib/device-identity.ts
git commit -m "refactor: drop the per-viewer you marker from settle-up; delete device-identity.ts"
```

---

### Task 7: Add the one-time "save this link" reminder banner

**Files:**
- Modify: `src/app/g/[groupId]/events/page.tsx`
- Modify: `src/components/events/EventsListView.tsx`

**Interfaces:**
- Consumes: the `savelink` query param produced by Task 1's redirect.
- Produces: nothing consumed elsewhere.

- [ ] **Step 1: Read the `savelink` search param on the server and pass it down**

Replace `src/app/g/[groupId]/events/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { requireSession, SessionError } from "@/lib/auth/require-session";
import { listGroupEvents } from "@/lib/events";
import { prisma } from "@/lib/prisma";
import { EventsListView } from "@/components/events/EventsListView";

// Screen Spec P3-02/P3-03. Server Component: reads the session set at
// /g/[groupId] and loads data directly via Prisma (CLAUDE.md rule 7 — all
// DB access goes through server code).
export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ savelink?: string }>;
}) {
  const { groupId } = await params;
  const { savelink } = await searchParams;

  let session;
  try {
    session = await requireSession();
  } catch (error) {
    if (error instanceof SessionError) redirect("/");
    throw error;
  }
  if (session.groupId !== groupId) redirect("/");

  const group = await prisma.group.findUnique({ where: { id: groupId }, select: { name: true } });
  if (!group) redirect("/");

  const events = await listGroupEvents(groupId);

  return (
    <EventsListView
      groupId={groupId}
      groupName={group.name}
      viewerRole={session.role}
      saveLinkToken={savelink ?? null}
      events={events.map((event) => ({
        id: event.id,
        name: event.name,
        currency: event.currency,
        memberCount: event.memberCount,
        totalSpend: event.totalSpend,
        unsettledAmount: event.unsettledAmount,
      }))}
    />
  );
}
```

- [ ] **Step 2: Accept the prop, show the banner, and strip the query param**

In `src/components/events/EventsListView.tsx`:

Add `useEffect` and `useRouter` to the imports (add `useRouter` from
`next/navigation` and extend the existing `useState` import):

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GroupHeader } from "@/components/group/GroupHeader";
import { colorForSeed } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { CreateEventModal } from "./CreateEventModal";
```

Add `saveLinkToken` to the props interface:

```tsx
interface EventsListViewProps {
  groupId: string;
  groupName: string;
  viewerRole: "editor" | "viewer";
  saveLinkToken: string | null;
  events: EventSummary[];
}
```

Update the component to strip the query param on mount, track whether the
banner is dismissed, and render it. Replace:

```tsx
export function EventsListView({ groupId, groupName, viewerRole, events }: EventsListViewProps) {
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const canEdit = viewerRole === "editor";

  return (
```

with:

```tsx
export function EventsListView({
  groupId,
  groupName,
  viewerRole,
  saveLinkToken,
  events,
}: EventsListViewProps) {
  const router = useRouter();
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showSaveLinkBanner, setShowSaveLinkBanner] = useState(saveLinkToken !== null);
  const canEdit = viewerRole === "editor";

  // The token arrives as a one-time query param from the /g/{token} redirect
  // (CLAUDE.md rule 8: never let it sit persistently in the address bar) —
  // strip it immediately so a refresh or re-visit never shows it again.
  useEffect(() => {
    if (saveLinkToken !== null) {
      router.replace(`/g/${groupId}/events`);
    }
  }, [saveLinkToken, groupId, router]);

  return (
```

Add the banner just after `<GroupHeader groupName={groupName} />` inside the
`<div className="mx-auto max-w-[1160px]">` wrapper:

```tsx
        <GroupHeader groupName={groupName} />

        {showSaveLinkBanner && saveLinkToken && (
          <SaveLinkBanner token={saveLinkToken} onDismiss={() => setShowSaveLinkBanner(false)} />
        )}

```

- [ ] **Step 3: Add the `SaveLinkBanner` component**

Add this new function at the end of `src/components/events/EventsListView.tsx`
(after the existing `EventCard` function):

```tsx
function SaveLinkBanner({ token, onDismiss }: { token: string; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const link = `${window.location.origin}/g/${token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-6 flex items-center justify-between gap-3 rounded-md border border-ink/10 bg-mint-tint px-4.5 py-3 dark:border-white/10 dark:bg-mint/16">
      <p className="text-[12.5px] leading-snug text-emerald dark:text-mint">
        Save this link to get back in — there&apos;s no account, so this is the only way back.
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="rounded-md bg-forest px-3.5 py-2 text-[12.5px] font-bold whitespace-nowrap text-cream dark:bg-dark-forest"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="text-[13px] text-muted-2"
        >
          ×
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run `npm run dev`. Create a group, copy its editor link, open it in an
incognito window. Confirm:
- You land on `/g/{groupId}/events` with the banner visible.
- The address bar has no `?savelink=...` by the time the page has settled
  (check via the URL bar, or `view-source:` — it should read the clean
  `/g/{groupId}/events`).
- Clicking "Copy link" changes the button text to "Copied!" for ~2s; paste
  somewhere to confirm the clipboard holds `http://localhost:3000/g/{token}`
  (the original token-bearing link, not the clean URL).
- Clicking × hides the banner; refreshing the page does not bring it back
  (no `savelink` param anymore).
- Repeat with a viewer link (regenerate one from the Share dialog) and
  confirm the banner appears there too.

- [ ] **Step 6: Commit**

```bash
git add src/app/g/\[groupId\]/events/page.tsx src/components/events/EventsListView.tsx
git commit -m "feat: add a one-time save-this-link reminder after opening a share link"
```

---

### Task 8: Update CLAUDE.md and project docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `docs/data-model.md`
- Modify: `docs/system-design.md`
- Modify: `docs/FairShareTab - Screen Spec.md`

- [ ] **Step 1: Rewrite CLAUDE.md rule 5**

In `CLAUDE.md`, replace:

```md
**5. The viewer's name is shown, never the bare word "You".** Render the real member
name plus a quiet "you" marker (`Sarah (you)`, or a chip / avatar ring). People
screenshot these screens into group chats — "Sarah owes RM 158.30" must be meaningful
to everyone who sees it. This applies to every screen including the settle-up graph.
```

with:

```md
**5. Member names are shown plainly, identically to everyone with the link.**
No per-viewer identity is tracked anywhere in the app, so there is no "you" to
mark — access is granted purely by which link you opened, not by who you are.
People screenshot these screens into group chats — "Sarah owes RM 158.30" must
be meaningful to everyone who sees it, which a plain name already is.
```

- [ ] **Step 2: Update data-model.md §4 (device identity) and §7 (display rule)**

Replace the "What is *not* in the database" section (currently):

```md
## 4. What is *not* in the database

**Device identity.** When someone opens a share link they pick which member they are.
That choice is stored **client-side only** (cookie or `localStorage`), as a map of
`group_id → member_id` so one device can hold identities in several groups.

It is an unverified self-declaration — treat it as **personalisation, never
authorisation**. Access is granted by the share token; the claimed member only decides
whose name gets the "you" marker.
```

with:

```md
## 4. What is *not* in the database

**Per-viewer identity.** Access is granted purely by which share link (token)
was opened — there is no concept of "which member is browsing" stored
anywhere, client- or server-side. Anyone with an editor link can act as any
member; anyone with a viewer link sees everything read-only. This is a
deliberate simplification: no localStorage, no "who am I" step, and no
per-viewer "you" marker (§7 below no longer applies).
```

Replace §7 ("Display rule: the viewer's own name"), currently:

```md
## 7. Display rule: the viewer's own name

The viewer's member record renders as **their actual name plus a quiet "you" marker** —
never as the bare word "You".

- Correct: `Sarah (you)`, or `Sarah` with a "you" chip / highlighted avatar ring.
- Wrong: `You`, `You owe RM 158.30`, `Paid by You`.
```

with:

```md
## 7. Display rule: member names

Member names render plainly and identically for anyone with the link — there
is no per-viewer identity to mark, so there is no "you" variant anywhere.

- Correct: `Sarah`, `Sarah owes RM 158.30`, `Paid by Sarah`.
- Not applicable: any per-viewer "you" rendering — no such state exists.
```

- [ ] **Step 3: Update data-model.md §9 (phase-2 auth path)**

In §9, change line 3 (currently referencing "the member that device had
already claimed"):

```md
3. On signup, set `member.user_id` on the member that device had already claimed. All
   historical bills, splits and balances carry over untouched.
```

to:

```md
3. On signup, link `member.user_id` to the authenticated user's chosen member
   record. All historical bills, splits and balances carry over untouched.
```

- [ ] **Step 4: Update system-design.md §3.4 (identity section) — remove it**

Delete the entire "### 3.4 Identity (separate from access)" section
(currently lines 93-101):

```md
### 3.4 Identity (separate from access)

After access is granted, the visitor picks which member they are on the "Who are you?"
screen. Store client-side as a map `group_id → member_id`.

This is **personalisation, not authorisation** — never gate a permission on it. Its
only job is deciding whose name carries the "you" marker (`data-model.md` §7).

Provide a "That's not me — switch member" escape hatch for a mis-claim.

---
```

Replace it with just the trailing `---` separator (i.e. remove the section
heading and body, keep the divider so §3.3 and §4 remain separated).

- [ ] **Step 5: Update system-design.md §5 API table**

Remove the claim row and its follow-up sentence. Change:

```md
| `POST` | `/api/groups` | Create a group. Body: `{ name, creatorName }`. Creates the group, its first member (`creatorName`), and an `editor` share link in one transaction. Returns the group and link. |
| `GET` | `/g/{token}` | Validate token → set session cookie → redirect to the group. Invalid/revoked → error screen. |
| `POST` | `/api/groups/{id}/claim` | Record which member the device is. Sets the client-side identity. |

`creatorName` is **required** — without it the owner becomes an unnamed member, which
is what forced the old "You" label (`data-model.md` §7).
```

to:

```md
| `POST` | `/api/groups` | Create a group. Body: `{ name, creatorName }`. Creates the group, its first member (`creatorName`), and an `editor` share link in one transaction. Returns the group and link. |
| `GET` | `/g/{token}` | Validate token → set session cookie → redirect to the events list. Invalid/revoked → error screen. |

`creatorName` is **required** — it's the name that appears on the group's first
bills and balances, same as any other member.
```

- [ ] **Step 6: Update system-design.md §6.1 and §6.2 workflows**

Change:

```md
### 6.1 Create a group (owner entry)

Landing → "Create group" → `{ groupName, creatorName }` → server creates group + first
member + editor link in one transaction → device identity set to that member → land on
the events list. Currency is chosen later, per event, when the first event is created.

### 6.2 Join via link (invitee entry)

Open `/g/{token}` → validate → session cookie → clean redirect → "Who are you?" →
pick an existing member or add themselves → identity stored on device → events list.
```

to:

```md
### 6.1 Create a group (owner entry)

Landing → "Create group" → `{ groupName, creatorName }` → server creates group + first
member + editor link in one transaction → land directly on the events list. Currency is
chosen later, per event, when the first event is created.

### 6.2 Open a link (invitee entry)

Open `/g/{token}` → validate → session cookie → clean redirect straight to the events
list. No identity step — access and role (editor/viewer) come entirely from which link
was opened. A one-time "save this link" banner offers a copy-link button on first
landing, since there's no other way back in without the original link.
```

- [ ] **Step 7: Update system-design.md §7 and §8**

In §7 (validation rules), remove the now-inapplicable claim-adjacent line if
present (check for any "mis-claimed" or "claim" mention beyond §8; if none,
skip this step).

In §8 (edge cases), change:

```md
- **Mis-claimed identity** — provide "switch member"; it changes only the "you" marker.
```

to:

```md
- **Lost or unsaved link** — there's no device-side fallback once you navigate away
  without saving the link (no localStorage, no login). The one-time save-link banner
  (§6.2) is the mitigation, not a full solution — if a link is truly lost, whoever
  shared it must resend it (or an editor can regenerate/reshare from the Share dialog).
```

- [ ] **Step 8: Update the Screen Spec**

In `docs/FairShareTab - Screen Spec.md`:

Replace the top-level display rule (line 5), currently:

```md
**Display rule — the viewer's own member:** the viewer's member renders as their name plus a "you" marker — never as the word "You" alone. In rosters and lists (dashboard member chips, add-bill Paid-by/Split-between/breakdown lists, the settle-up transfer graph, and confirm-transfer dialogs) the marker is a small mint "you" pill next to the name plus a mint ring on the avatar; on space-constrained mobile scrollers the ring alone is used. Screenshots of any screen must read correctly to someone who isn't the viewer.
```

with:

```md
**Display rule — member names:** no per-viewer identity is tracked (CLAUDE.md rule 5) — every member renders as their plain name, identically for anyone with the link. Screenshots of any screen must read correctly to someone who isn't the viewer.
```

Replace the Part 1 intro (line 26):

```md
The app root with no share link and no stored identity yet.
```

with:

```md
The app root, shown identically to every visitor regardless of prior visits.
```

Replace the P1-01 entry (lines 28-35):

```md
### P1-01 — Landing — cold visitor
- **Route:** App root, / — no share link, no stored member identity on this device
- **Entered from:** a bare visit to the app root.
- **Exits to:** P1-03 (I have an invite link) or to the Create-group flow inside P3-01 Group switcher.
- **Data read:** None — static marketing content plus the transfer-graph illustration
- **Actions → writes:** Create a group → opens the create-group modal (P3-01). I have an invite link → expands P1-03 inline.
- **States:** Default only
- **Notes:** Only shown when no member identity is stored on this device at all — see P1-02 for the returning-device case.
```

with:

```md
### P1-01 — Landing
- **Route:** App root, /
- **Entered from:** a bare visit to the app root.
- **Exits to:** P1-03 (I have an invite link) or the Create-group modal (P2-01).
- **Data read:** None — static marketing content plus the transfer-graph illustration
- **Actions → writes:** Create a group → opens the create-group modal (P2-01). I have an invite link → expands P1-03 inline.
- **States:** Default only
- **Notes:** The only landing view — shown to every visitor regardless of device history. Access to a group is granted purely by opening its link; there is no returning-device variant and no join/claim step.
```

Delete the P1-02 entry entirely (lines 37-44):

```md
### P1-02 — Landing — returning device
- **Route:** App root, / — a member identity is already stored on this device
- **Entered from:** a bare visit to the app root when a prior claim exists.
- **Exits to:** the stored group's events list (P3-02) on Continue, or to P1-01 via Use a different link.
- **Data read:** This device's stored member identity and the list of groups it belongs to (name, initials, color, member count)
- **Actions → writes:** Continue to [Group] → opens that group's events list. Row tap on another stored group → switches to it. Use a different link → clears the shortcut and falls back to the paste-link flow.
- **States:** Default only
- **Notes:** This is the state most repeat visitors see — no marketing content, fastest path back in.
```

Update the P1-03 entry's "Exits to" and "Actions → writes" lines — change:

```md
- **Exits to:** P2-04 Who are you (claim) on a valid link, or stays open with an inline error on an invalid one.
- **Data read:** None until submitted; the pasted string is validated client-side against the expected link shape
- **Actions → writes:** Continue → validates the pasted link and navigates to P2-04, or shows the inline error state shown here.
```

to:

```md
- **Exits to:** the group's events list (P3-02) on a valid link, or stays open with an inline error on an invalid one.
- **Data read:** None until submitted; the pasted string is validated client-side against the expected link shape
- **Actions → writes:** Continue → validates the pasted link and navigates straight into the group, or shows the inline error state shown here.
```

Update the P2-01 entry (lines 58-65) — change:

```md
### P2-01 — Create group (cross-reference)
- **Route:** Modal, no dedicated path — opened from Group switcher → + Create new group
- **Entered from:** P3-01 Group switcher.
- **Exits to:** P3-02 Events list (new, empty group) on Create, or back to P3-01 on Cancel.
- **Data read:** None — blank form
- **Actions → writes:** Create group → writes a new Group{name, currency} and makes it active. Cancel → discards, no write.
- **States:** Default only
- **Notes:** See P3-01 for the actual mockup; not duplicated here.
```

to:

```md
### P2-01 — Create group (cross-reference)
- **Route:** Modal, no dedicated path — opened from the landing page's Create a group button
- **Entered from:** P1-01 Landing.
- **Exits to:** P3-02 Events list (new, empty group) on Create, or back to P1-01 on Cancel.
- **Data read:** None — blank form
- **Actions → writes:** Create group → writes a new Group{name} and its first Member{creatorName}, plus an editor share link. Cancel → discards, no write.
- **States:** Default only
- **Notes:** See P1-01 for the actual mockup; not duplicated here.
```

Delete the P2-04 entry entirely (lines 84-91):

```md
### P2-04 — Who are you — member claim
- **Route:** /g/:groupId/join
- **Entered from:** Entered by opening a shared link for the first time on a device.
- **Exits to:** P3-02 Events list once a member is chosen, or to P4-04 via I'm not listed.
- **Data read:** Group.name, Group.members[] (active only: name, avatar/initials)
- **Actions → writes:** Select a member chip → stages the choice. Continue as [Name] → writes the chosen memberId to this device's local storage. I'm not listed → opens P4-04 add-member.
- **States:** Unselected (Continue not actionable) / selected (pictured)
- **Notes:** Claim is per device, not per person — a shared computer needs re-claiming for each user. ↳ the chosen member id is stored in this browser's local storage — no login, no password. Reopening the same link on this device skips straight to the group next time.
```

Delete the P3-01 entry entirely (lines 104-111):

```md
### P3-01 — Group switcher
- **Route:** Dropdown/sheet over any /g/:groupId/* route
- **Entered from:** the nav pill on any in-group screen.
- **Exits to:** P3-02 Events list of the chosen group, or opens the Create-group modal (P2-01).
- **Data read:** The claimed member's Group[] (name, avatar/initials, member count, active flag)
- **Actions → writes:** Select a group row → switches active group, navigates to its events list. + Create new group → opens the create-group modal.
- **States:** Collapsed (nav pill) / open (dropdown desktop, sheet mobile) / create-group modal (filled, and your-name-missing validation)
- **Notes:** List is scoped to groups the claimed member on this device belongs to. The create-group modal now also requires **Your name** (with helper text: "This is how the group will see you in bills and balances") — the creator was previously left as an unnamed member. Missing name blocks the Create-group button (disabled state) and shows a coral inline error, same pattern as other required-field validation in the file.
```

Update the P3-02 entry's "Entered from" line — change:

```md
- **Entered from:** P3-01 switcher, P2-04 claim screen, or app launch (last-active group).
```

to:

```md
- **Entered from:** opening a share link (direct or pasted at P1-01), or creating a new group (P2-01).
```

Update the P4-04 entry (lines 167-173) — change:

```md
### P4-04 — Member management — add / inline rename / deactivate
- **Route:** Modal (desktop) / bottom sheet (mobile) over P4-01; rename & deactivate act in place on the dashboard's member chips
- **Entered from:** P4-01 + Add member or P2-04 I'm not listed. Exits back to P4-01 on save/cancel.
- **Data read:** Event.members[] (for rename/deactivate); new-member form (name, optional email)
- **Actions → writes:** Add member → writes a new Member. Tap name → inline rename, writes Member.name (including the viewer's own — same affordance, no separate UI). Press-hold → opens P4-05 deactivate confirm. That's not me — switch member → clears this device's claimed identity and returns to the paste-link flow (P1-03), recovering from a mis-claim.
- **States:** Add form / inline-rename (shown for both another member and the viewer's own, tagged with the "you" marker) / deactivated (55% opacity, Reactivate link)
- **Notes:** Members are never hard-deleted — deactivation is the only removal path, and it's reversible. "That's not me" is the only recovery path from claiming the wrong identity at P2-04 — previously there was none.
```

to:

```md
### P4-04 — Member management — add / inline rename / deactivate
- **Route:** Modal (desktop) / bottom sheet (mobile) over P4-01; rename & deactivate act in place on the dashboard's member chips
- **Entered from:** P4-01 + Add member. Exits back to P4-01 on save/cancel.
- **Data read:** Event.members[] (for rename/deactivate); new-member form (name, optional email)
- **Actions → writes:** Add member → writes a new Member. Tap name → inline rename, writes Member.name.
- **States:** Add form / inline-rename / deactivated (55% opacity, Reactivate link)
- **Notes:** Members are never hard-deleted — deactivation is the only removal path, and it's reversible.
```

- [ ] **Step 9: Confirm no remaining stale cross-references**

Run: `grep -n "P2-04\|P1-02\|P3-01 Group switcher\|device identity\|claim" "docs/FairShareTab - Screen Spec.md" docs/data-model.md docs/system-design.md CLAUDE.md`

Expected: no remaining hits describing the removed join/claim/switcher flow
as if it still exists. (A hit is fine if it's part of the edits just made
above reading correctly — re-check any surviving match by hand.)

- [ ] **Step 10: Commit**

```bash
git add CLAUDE.md docs/data-model.md docs/system-design.md "docs/FairShareTab - Screen Spec.md"
git commit -m "docs: update rule 5, data model, system design, and screen spec for link-only access"
```

---

### Task 9: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full check suite**

Run: `npm test && npx tsc --noEmit && npm run lint && npm run build`
Expected: all four pass with no errors. (`npm test` should show the same
Vitest suite count as before this refactor — no tests were added or removed
by this plan.)

- [ ] **Step 2: Manual browser walkthrough — editor link**

Run `npm run dev`. Create a group ("Trip Squad", creator "Sarah"). Confirm:
- No currency/localStorage-related prompt appears during creation.
- You land directly on the events list; the save-link banner appears once,
  with a working Copy link button; dismissing it or refreshing removes it.
- Create an event, add a bill with 2+ participants, confirm no "(you)"
  marker or personal avatar appears anywhere (dashboard member chips,
  Paid-by/Split-between pickers, the equal-split breakdown).
- Settle up the event; confirm the transfer graph and mobile transfer cards
  show plain names with no "(you)" marker or highlighted ring.

- [ ] **Step 3: Manual browser walkthrough — viewer link**

From the Share dialog, regenerate/reveal the viewer link. Open it in a
separate incognito window. Confirm:
- You land directly on the events list, read-only (no "+ Add bill", "+ Add
  member", "Share", or edit affordances anywhere).
- The save-link banner also appears here with a working Copy link button.
- Attempting a direct API mutation (e.g. `fetch` a POST to
  `/api/events/{id}/bills` from the browser console) is rejected with 403 —
  confirms server-side role enforcement (CLAUDE.md rule 9) is untouched.

- [ ] **Step 4: Confirm the removed routes are gone**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/g/some-existing-group-id/join
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/api/groups/some-existing-group-id/claim
```
Expected: both return `404`.

- [ ] **Step 5: Stop the dev server; no commit for this task (verification only)**

If any step in this task fails, return to the relevant earlier task, fix it
there, and re-run this task's checks from Step 1.
