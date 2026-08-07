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
deactivate, never delete), events with a per-event currency (curated list, default
MYR), bills with equal or custom splits, debt simplification with a visual transfer
graph, landing page.

**Out of scope (v1):** authentication (designed for — `data-model.md` §9),
changing an event's currency after its first bill, cross-currency settlement,
multiple payers per bill, receipts.

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

Access is granted by a **capability link** scoped to a whole group, **or** by an
authenticated **member session** for a registered user — both coexist permanently.
Anyone holding a valid link token can act within that group at its role level
(`editor` or `viewer`); a registered user with a `group_membership` row can act in
that group at their membership's role, without a link at all. Registration is
optional — the anonymous flow is unaffected either way (data-model.md §9).

### 3.2 Request flow

**Anonymous (link) entry:**
1. A visitor opens `/g/{token}`.
2. The server looks up `group_share_link` by token. Reject if missing or
   `revoked_at IS NOT NULL` → render the invalid-link screen.
3. **Exchange the token for a session cookie** (`httpOnly`, `Secure`, `SameSite=Lax`)
   containing `{ kind: "link", group_id, role, share_link_id }`, then redirect to a
   clean URL such as `/g/{groupId}/events`.
4. Every subsequent request reads the cookie. No token in the address bar.

**Authenticated (member) entry:**
1. A registered user logs in at `/login` — a separate, group-independent
   `fst_user_session` cookie (`{ user_id }`) is set, distinct from the group-context
   cookie above (a browser can be logged in as a user *and* separately hold a
   share-link session for an unrelated group at the same time).
2. From `/account/groups`, entering a specific group looks up that user's
   `group_membership` for it and mints a `{ kind: "member", group_id, role, user_id,
   membership_id }` session cookie, then redirects to `/g/{groupId}/events` — the same
   destination as the anonymous flow.
3. Every subsequent request within that group reads the same group-context cookie as
   the anonymous flow does; the revocation check just branches on `kind` (§3.3).

**Landing page ("/"):** a logged-in user (`fst_user_session` present) is redirected to
`/account/groups` regardless of whether a group-context session is also present — the
account is the durable identity, and a held group session survives the redirect
untouched. Otherwise, a valid `fst_session` redirects straight to that group's events
list. Only someone holding neither, or an invalid/revoked one, sees the marketing
landing page.

**`/login` and `/register`** apply the same "don't show a page that has nothing to
offer someone in this state" logic, but not identically:

- `/login` redirects on either signal, same precedence as `/` — logged in wins, then a
  valid group session, then the form renders.
- `/register` redirects only when logged in. A valid group session is deliberately
  **not** redirected away here — `ShareDialog`'s claim nudge (§3.3) and
  `CreateGroupModal`'s guest-cap message both link to `/register` precisely while the
  visitor holds a valid group session, since registering *is* how a guest claims the
  group they're standing in. Gating `/register` on a group session the same way `/`
  does would send that visitor straight back into the group before they ever saw the
  form.

### 3.3 Non-negotiable rules

- Generate tokens with a CSPRNG, ≥128 bits, base62 (~22 chars). Never sequential IDs.
- **Get the token out of the URL on first visit** — URLs leak via history,
  screenshots, referrer headers, and shared screens.
- Send `X-Robots-Tag: noindex` on all group routes.
- Support **regenerate**: set `revoked_at` on the current link, issue a new row. The
  old link stops working immediately. **Revoking an existing link is a
  registered-member action only** — an anonymous editor-link holder must never be able
  to lock a registered owner out of their own group. Creating a link for a role that
  currently has none is not destructive and stays open to any editor.
- Rate-limit token lookups (e.g. 10/min/IP) to blunt brute force.
- `viewer` role must be enforced **server-side** on every mutating endpoint. Hiding
  buttons in the UI is not access control.
- Be honest in the UI: the share dialog states plainly that anyone with the link can
  view and edit.
- Passwords are hashed with Argon2id, never stored or logged in plaintext, and
  `password_hash` never appears in an API response (data-model.md §6 invariant 12).
- An anonymous visitor may create at most one group, enforced by a signed, long-lived
  `fst_visitor_created_group` cookie set on their first `POST /api/groups` — soft/
  best-effort by design (clearing cookies resets it), not a security boundary. A
  registered user has no such cap.
- `login` and `register` are rate-limited the same way token lookups are (§3.3 above);
  `login` returns a generic "Invalid email or password" for both a nonexistent email
  and a wrong password, to avoid user enumeration.
- `forgot` and `reset` carry the same per-IP limiter, but it is explicitly *not* what
  their abuse resistance rests on — it is in-memory and per-instance, so it does not
  survive serverless. The load-bearing controls are the DB-backed per-account cooldown
  and daily cap in data-model.md §3.11. Note the resulting structural bound: a token is
  only ever created for an *existing* account, so total daily sends cannot exceed
  `registered_users × 5` regardless of attacker effort. There is deliberately **no**
  global send cap — one attacker tripping it would deny password reset to everyone,
  turning a bounded nuisance into an outage.
- **Session invalidation on password change.** Both session cookies carry an `issuedAt`
  and are re-checked against `user.password_changed_at` on every request. This covers
  `fst_session`'s `kind: "member"` variant as well as `fst_user_session`: a password
  change leaves the `group_membership` row untouched, so without that check an attacker
  holding a group cookie would keep editor access after the owner reset their password.
  A member cookie with no `issuedAt` is rejected rather than trusted — unlike the
  permissive "no `kind` means link session" fallback, treating a missing field as valid
  here is exactly the hole the mechanism closes.

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

REST over JSON. **All amounts are integers in the event currency's smallest unit.**
Every route below is server-side and performs the §3 access check first.

### Landing / access

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/groups` | Create a group. Body: `{ name, creatorName }`. Creates the group, its first member (`creatorName`), and an `editor` share link in one transaction. Returns the group and link. |
| `GET` | `/g/{token}` | Validate token → set session cookie → redirect to the events list. Invalid/revoked → error screen. |
| `POST` | `/api/session/exit` | Clears the group-context session cookie. Used by a visitor's "Exit group" control; requires no valid session, since it must work from a revoked one too. |

`creatorName` is **required** — it's the name that appears on the group's first
bills and balances, same as any other member. If the caller is authenticated
(`fst_user_session` present), the transaction also creates a `group_membership` and
links the creator `member.user_id` — no visitor cap applies. If not, the anonymous
one-group cap (§3.3) is enforced instead.

### Auth / account (optional — anonymous flow is unaffected)

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Body `{ email, password }`. Creates a `user`. If the request carries a valid `fst_visitor_created_group` cookie, claims that group into the new account in the same transaction (data-model.md §9). Sets `fst_user_session`. |
| `POST` | `/api/auth/login` | Body `{ email, password }`. Sets `fst_user_session`. Generic error on bad credentials (§3.3). |
| `POST` | `/api/auth/logout` | Clears `fst_user_session`. Also clears `fst_session` if it's currently a `kind: "member"` session (that kind only ever means "acting in this group as this account," so it has no meaning post-logout) — but never a `kind: "link"` session, which is an anonymous capability unrelated to any account. |
| `POST` | `/api/auth/forgot` | Body `{ email }`. Always returns the same generic 200, whether the email matched, did not match, or was throttled — any observable difference would leak account existence. On a match, and within the per-account limits (data-model.md §3.11), issues a `password_reset_token` and emails a link built from `APP_URL`. The send is deferred with `after()` so a match and a miss take the same time. |
| `POST` | `/api/auth/reset` | Body `{ token, newPassword }`. Verifies an unused, unexpired token, then in one transaction rehashes the password, stamps `user.password_changed_at`, and marks every outstanding token for that user used. Issues no session — auto-login would let the emailed token itself mint one. One generic error for unknown/used/expired. |
| `GET` | `/api/auth/me` | Returns the current user (or 401), for client-side auth-state checks. |
| `GET` | `/api/account/groups` | Lists every group with a `group_membership` for the logged-in user. Requires `fst_user_session`. |
| `POST` | `/api/account/groups/{groupId}/enter` | Mints a `{ kind: "member" }` group-context session cookie from the caller's `group_membership`, redirects to `/g/{groupId}/events`. POST (not GET, since it's state-changing) submitted via a `<form>` so it's still a normal full-page navigation, not a client-side fetch. |

### Share links

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/groups/{id}/links` | List active links (editor + viewer). |
| `POST` | `/api/groups/{id}/links/regenerate` | Revoke current link of a role, issue a new one. **Revoking an existing link requires a registered-member session** — an anonymous editor-link holder may only create a link for a role that has none yet, never replace one. |
| `GET` | `/api/groups/{id}/context` | Whether the group has an owner, the owner's member name if so, and whether the caller specifically can claim it (session-persistence-and-ownership design). |

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
| `POST` | `/api/groups/{id}/events` | Create `{ name, currency?, startDate?, endDate?, memberIds[] }`. `currency` defaults to `MYR`; see the curated list in `data-model.md` §5. |
| `GET` | `/api/events/{id}` | Detail with members, bills, and computed balances. |
| `PATCH` | `/api/events/{id}` | Rename, change dates, or archive. Currency cannot be changed here — it is fixed at creation and locked once the event has its first bill. **On an archived event this 409s**, along with every other event-scoped write; the sole exception is a payload of `{ status: "active" }` alone, and bundling `name` or a date with that restore is rejected too (`data-model.md` §6 invariant 14). |

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
| `POST` | `/api/events/{id}/settlement/preview` | Body `{ billIds[] }`. Returns net balances + simplified transfers. **Does not persist.** |
| `POST` | `/api/events/{id}/settlement/confirm` | Persists the settlement, its transfers, and marks the included bills `settled`. One transaction. |

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

Landing → "Create group" → `{ groupName, creatorName }` → server creates group + first
member + editor link in one transaction → land directly on the events list. Currency is
chosen later, per event, when the first event is created.

### 6.2 Open a link (invitee entry)

Open `/g/{token}` → validate → session cookie → clean redirect straight to the events
list. No identity step — access and role (editor/viewer) come entirely from which link
was opened. A one-time "save this link" banner offers a copy-link button on first
landing, since there's no other way back in without the original link.

### 6.2b Register, optionally claiming a visitor's group

From the tutorial/landing "Create an account" CTA or the nudge inside the share
dialog → `{ email, password }` → server creates the `user`; if the browser still
holds the `fst_visitor_created_group` cookie from a group it created as a visitor,
that group's creator `member` is linked to the new account and a `group_membership`
is created, in the same transaction → `/account/groups` shows that group immediately,
no re-entry step needed.

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

- `totalAmount > 0`, integer in the event currency's smallest unit.
- `SUM(split.shareAmount) === bill.totalAmount` on every create and update.
- Every `shareAmount >= 0`, integer.
- At least one participant per bill.
- `payerId` and every participant are members of the event's group.
- Names non-empty after trimming; `creatorName` required on group creation.
- Event `currency` must be one of the curated codes; defaults to `MYR`; rejected on
  `PATCH` once the event has a bill.
- Settlement includes only `unsettled` bills from the same event.
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
- **Lost or unsaved link** — there's no device-side fallback once you navigate away
  without saving the link (no localStorage, no login). The one-time save-link banner
  (§6.2) is the mitigation, not a full solution — if a link is truly lost, whoever
  shared it must resend it (or an editor can regenerate/reshare from the Share dialog).
- **Revoked link mid-session** — session cookies must be validated against
  `revoked_at` on each request, not just at exchange time.
- **A visitor wants to leave a group** — `fst_session` is otherwise only ever
  replaced, never cleared; `POST /api/session/exit` gives a visitor an explicit way
  out, back to the landing page.
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
