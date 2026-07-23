# System Design — FairShareTab

**Version 2.0 · Supersedes v1.** Companion to `data-model.md`.

Architecture, access control, API surface, core algorithms, validation, and build
order.

---

## 1. Goals and scope

A web app where a group of friends or family creates trips, logs bills, and settles up
with the fewest possible person-to-person transfers, while everyone ends up exactly
financially whole.

**In scope (v1):** groups with shareable-link access, members (add / rename /
deactivate, never delete), events, bills with equal or custom splits, debt
simplification with a visual transfer graph, landing page, MYR only.

**Out of scope (v1):** authentication (designed for — `data-model.md` §9),
multi-currency, multiple payers per bill, receipts.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | UI and server logic in one codebase. Server code holds all secrets. |
| Styling | **Tailwind CSS** | Design tokens map into `tailwind.config.ts` — see §9. |
| UI primitives | **shadcn/ui** (optional) | Modals, dropdowns, sheets — all used by the mockups. |
| Database | **PostgreSQL** (Supabase, region `ap-southeast-1` Singapore) | Used as a plain managed Postgres. See the warning below. |
| ORM | **Prisma** | Migrations + Prisma Studio for inspecting split math. |
| Validation | **Zod** | One schema shared by client and server. |
| Testing | **Vitest** | Mandatory for the settlement engine. |
| Hosting | **Vercel** (Singapore region) | |
| Fonts | Instrument Serif + Work Sans via `next/font/google` | |

> **Important — do not use Supabase Row Level Security for access control.**
> RLS keys off `auth.uid()`, and v1 has no authenticated users. Never expose the
> Supabase anon key to the browser for app data. **All database access goes through
> Next.js server code**, which validates the share-token session cookie first. The
> service key stays server-side only. This also means phase-2 login drops in without
> rearchitecting.

```
[ Next.js client ]
      │  fetch / server actions
[ Next.js server: access check → validation → domain logic ]
      │                                  │
[ Prisma → PostgreSQL ]        [ settlement engine — pure, unit-tested ]
```

The settlement engine has **no framework or database dependencies**. It takes net
balances in and returns transfers out. Build and test it first.

---

## 3. Access control

### 3.1 The model

Access is granted by a **capability link** scoped to a whole group. There are no
accounts or passwords. Anyone holding a valid link token can act within that group at
its role level (`editor` or `viewer`).

### 3.2 Request flow

1. A visitor opens `/g/{token}`.
2. The server looks up `group_share_link` by token. Reject if missing or
   `revoked_at IS NOT NULL` → render the invalid-link screen.
3. **Exchange the token for a session cookie** (`httpOnly`, `Secure`, `SameSite=Lax`)
   containing `{ group_id, role }`, then redirect to a clean URL such as
   `/g/{groupId}/events`.
4. Every subsequent request reads the cookie. No token in the address bar.

### 3.3 Non-negotiable rules

- Generate tokens with a CSPRNG, ≥128 bits, base62 (~22 chars). Never sequential IDs.
- **Get the token out of the URL on first visit** — URLs leak via history,
  screenshots, referrer headers, and shared screens.
- Send `X-Robots-Tag: noindex` on all group routes.
- Support **regenerate**: set `revoked_at` on the current link, issue a new row. The
  old link stops working immediately.
- Rate-limit token lookups (e.g. 10/min/IP) to blunt brute force.
- `viewer` role must be enforced **server-side** on every mutating endpoint. Hiding
  buttons in the UI is not access control.
- Be honest in the UI: the share dialog states plainly that anyone with the link can
  view and edit.

### 3.4 Identity (separate from access)

After access is granted, the visitor picks which member they are on the "Who are you?"
screen. Store client-side as a map `group_id → member_id`.

This is **personalisation, not authorisation** — never gate a permission on it. Its
only job is deciding whose name carries the "you" marker (`data-model.md` §7).

Provide a "That's not me — switch member" escape hatch for a mis-claim.

---

## 4. Core domain logic

### 4.1 Net balance

For a chosen set of bills, for each member:

```
net(member) = SUM(bill.total_amount WHERE bill.payer_id = member)
            − SUM(split.share_amount WHERE split.member_id = member)
```

`net > 0` → creditor (is owed). `net < 0` → debtor (owes). All nets sum to zero.

This one function powers both single-bill settlement (pass one bill) and combined
settlement (pass many). Same engine, different input set.

### 4.2 Debt simplification

Greedy net-balance matching. At most N−1 transfers for N people.

```ts
function simplifyDebts(nets: Map<MemberId, number>): Transfer[] {
  const creditors = maxHeap(entries where net > 0, by amount)
  const debtors   = maxHeap(entries where net < 0, by -net)   // store positive
  const transfers: Transfer[] = []

  while (creditors.notEmpty() && debtors.notEmpty()) {
    const [cred, credAmt] = creditors.pop()
    const [debt, debtAmt] = debtors.pop()
    const pay = Math.min(credAmt, debtAmt)

    transfers.push({ from: debt, to: cred, amount: pay })

    if (credAmt - pay > 0) creditors.push([cred, credAmt - pay])
    if (debtAmt - pay > 0) debtors.push([debt, debtAmt - pay])
  }
  return transfers
}
```

Every member's net position is preserved exactly — the algorithm reroutes *who pays
whom*, never *how much anyone nets*. Finding the theoretical minimum number of
transfers is NP-hard; this greedy approach is what production apps use: always correct,
near-optimal, O(N log N).

All amounts are integers (sen), so there is no drift.

### 4.3 Equal-split rounding

```ts
const base = Math.floor(total / n)
let remainder = total - base * n          // 0 <= remainder < n

// everyone gets `base`; distribute `remainder` sen, one each:
//   1. to the payer first, if the payer is a participant
//   2. then to remaining participants in member.created_at order
// invariant: sum === total, always
```

Example: `RM 250.00` (25000 sen) among 3 → `8334 / 8333 / 8333` → RM 83.34 / 83.33 /
83.33.

### 4.4 Required unit tests (Vitest)

Write these before any UI exists:

- Equal split divides evenly; sum equals total.
- Equal split with remainder 1 and remainder n−1; sum equals total; payer gets the
  extra sen when participating.
- Payer not a participant.
- Single-participant bill.
- Custom split that reconciles; custom split that doesn't (must reject).
- Net balances sum to zero across a mixed set of bills.
- `simplifyDebts` preserves every member's net exactly.
- `simplifyDebts` returns ≤ N−1 transfers.
- Already-balanced group returns zero transfers.
- A member who paid nothing and owes nothing is absent from transfers.

---

## 5. API endpoints

REST over JSON. **All amounts are integers in sen.** Every route below is
server-side and performs the §3 access check first.

### Landing / access

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/groups` | Create a group. Body: `{ name, currency, creatorName }`. Creates the group, its first member (`creatorName`), and an `editor` share link in one transaction. Returns the group and link. |
| `GET` | `/g/{token}` | Validate token → set session cookie → redirect to the group. Invalid/revoked → error screen. |
| `POST` | `/api/groups/{id}/claim` | Record which member the device is. Sets the client-side identity. |

`creatorName` is **required** — without it the owner becomes an unnamed member, which
is what forced the old "You" label (`data-model.md` §7).

### Share links

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/groups/{id}/links` | List active links (editor + viewer). |
| `POST` | `/api/groups/{id}/links/regenerate` | Revoke current link of a role, issue a new one. |

### Members

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/groups/{id}/members` | Add a member `{ name, email? }`. |
| `PATCH` | `/api/members/{id}` | Rename, or set `is_active`. |

**No delete endpoint exists.** Deactivation only.

### Events

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/groups/{id}/events` | List with computed total spend and unsettled amount. |
| `POST` | `/api/groups/{id}/events` | Create `{ name, startDate?, endDate?, memberIds[] }`. |
| `GET` | `/api/events/{id}` | Detail with members, bills, and computed balances. |
| `PATCH` | `/api/events/{id}` | Rename, change dates, or archive. |

### Bills

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/events/{id}/bills` | Create a bill with splits. |
| `PATCH` | `/api/bills/{id}` | Edit. **Rejects if `status = 'settled'`.** |
| `DELETE` | `/api/bills/{id}` | Delete (cascades to splits). Rejects if settled. |

Create/edit body:

```json
{
  "title": "Dinner at Ichiran",
  "totalAmount": 9000,
  "payerId": "member-uuid",
  "splitMethod": "equal",
  "participantIds": ["m1", "m2", "m3"],
  "customShares": null
}
```

For `splitMethod: "custom"`, send
`customShares: [{ "memberId": "m1", "shareAmount": 3000 }, ...]` and omit
`participantIds` — participation is implied by the shares.

### Settlement

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/groups/{id}/settlement/preview` | Body `{ billIds[] }`. Returns net balances + simplified transfers. **Does not persist.** |
| `POST` | `/api/groups/{id}/settlement/confirm` | Persists the settlement, its transfers, and marks the included bills `settled`. One transaction. |

Preview response:

```json
{
  "netBalances": [
    { "memberId": "m1", "name": "Sarah", "net": 22250 },
    { "memberId": "m3", "name": "Carol", "net": -15830 }
  ],
  "transfers": [
    { "fromMemberId": "m3", "toMemberId": "m1", "amount": 15830 }
  ]
}
```

---

## 6. Key workflows

### 6.1 Create a group (owner entry)

Landing → "Create group" → `{ groupName, currency: MYR, creatorName }` → server
creates group + first member + editor link in one transaction → device identity set to
that member → land on the events list.

### 6.2 Join via link (invitee entry)

Open `/g/{token}` → validate → session cookie → clean redirect → "Who are you?" →
pick an existing member or add themselves → identity stored on device → events list.

### 6.3 Add a bill

1. Pick participants, payer, split method.
2. Client computes the equal-split preview or the custom running total live on every
   keystroke; Save stays disabled until the shares reconcile.
3. Server **re-validates independently**: payer and participants belong to the group,
   and `SUM(shares) === totalAmount`.
4. Persist bill + splits in one transaction.

Client-side validation is UX. Server-side validation is correctness. Do both.

### 6.4 Settle up

1. Select unsettled bills (one, several, or all).
2. Server computes net balances over exactly those bills → `simplifyDebts`.
3. Render the transfer graph. Nodes show **real member names** so the screenshot makes
   sense to the whole group.
4. On confirm, persist settlement + transfers and set bills to `settled`, in one
   transaction.

---

## 7. Validation rules (server-enforced)

- `totalAmount > 0`, integer sen.
- `SUM(split.shareAmount) === bill.totalAmount` on every create and update.
- Every `shareAmount >= 0`, integer.
- At least one participant per bill.
- `payerId` and every participant are members of the event's group.
- Names non-empty after trimming; `creatorName` required on group creation.
- Settlement includes only `unsettled` bills from the same group.
- Mutating endpoints reject `role = 'viewer'`.
- Editing or deleting a `settled` bill is rejected.

---

## 8. Edge cases

- **Rounding** — handled by §4.3; never let the UI round independently of the server.
- **Payer not a participant** — valid (someone pays for others without partaking).
- **Single-participant bill** — valid; that member owes the full amount.
- **Deactivated member with a nonzero balance** — still settleable; only hidden from
  *new* bill pickers.
- **Editing a settled bill** — blocked. The UI shows a lock banner explaining it must
  be unsettled first.
- **Mis-claimed identity** — provide "switch member"; it changes only the "you" marker.
- **Revoked link mid-session** — session cookies must be validated against
  `revoked_at` on each request, not just at exchange time.
- **Concurrent edits** — last write wins is acceptable in v1; wrap each mutation in a
  transaction so splits and bills never diverge.

---

## 9. Design tokens → Tailwind

Extend `tailwind.config.ts` rather than hardcoding hex values in components:

- Forest `#163A2E`, Emerald `#1B9A62`, Mint `#35D28A`
- Cream `#F6F1E7`, app background `#EEE7D8`
- Ink `#16201B`, muted `#5B6961` / `#8A9490`
- Coral (owes) `#C24B36`
- Dark: page `#0E1712`, card `#16241D`
- Radii: 28 / 24 / 16 / 999 px
- Shadows: warm-toned `rgba(19,46,40,…)`, never pure black
- Money figures use `font-variant-numeric: tabular-nums`

Screen-by-screen routes, states, and actions live in
`FairShareTab - Screen Spec.md`; visual reference is
`FairShareTab - Mockups.dc.html`.

---

## 10. Build order

1. **Schema + Prisma migrations** from `data-model.md`.
2. **Settlement engine** as a pure module + the §4.4 Vitest suite. No database, no UI.
   Highest risk, easiest to verify in isolation — get it provably right first.
3. **Groups + share links + session exchange** (§3).
4. **Members** (add / rename / deactivate).
5. **Events** + event membership.
6. **Bills** with split validation.
7. **Settlement** preview and confirm endpoints.
8. **UI**, screen by screen, following the Screen Spec order: landing → entry &
   access → group & events → inside an event → bills → settle up → cross-cutting
   states.
