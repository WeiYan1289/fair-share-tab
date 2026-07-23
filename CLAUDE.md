# FairShareTab

A group bill-splitting web app. A **group** (circle of friends/family) holds
**members** and **events** (trips). Each event holds **bills**; each bill is divided
into **splits**. At the end, "settle up" reduces many bills to the fewest
person-to-person transfers while everyone ends up exactly financially whole.

Access is by **shareable link** — no accounts or passwords in v1.

## Documentation

Read these before making design decisions. They are authoritative; this file is only a
summary.

- `docs/data-model.md` — schema, fields, invariants. Source of truth for migrations.
- `docs/system-design.md` — architecture, access control, API, algorithms, build order.
- `docs/FairShareTab - Screen Spec.md` — every screen: ID, route, data, actions, states.
- `docs/FairShareTab - Mockups.dc.html` — visual reference. Read it for exact colors,
  spacing, and component structure.

Ignore anything in `docs/archive/` — superseded designs.

## Stack

Next.js 15 (App Router) + TypeScript · Tailwind CSS · PostgreSQL (Supabase) · Prisma ·
Zod · Vitest · Vercel. Fonts: Instrument Serif (display) + Work Sans (UI) via
`next/font/google`.

## Critical rules

These are correctness requirements, not preferences. Violating any of them is a bug.

**1. Money is integers in sen.** v1 is MYR only. `RM 12.50` is stored and computed as
`1250`. Never use float, never use decimal-as-string. Convert to display only at the UI
boundary (`sen / 100`, `RM 1,240.00`, always 2 decimal places).

**2. Splits must sum to the bill total.** `SUM(split.share_amount) === bill.total_amount`
for every bill, always. Validate on the server inside a transaction, on every create
and update. Client-side validation is UX only.

**3. Equal-split rounding is deterministic.** `base = floor(total / n)`, then
distribute the remainder sen one at a time — to the payer first if the payer
participates, then by `member.created_at`. Sum must equal total exactly.
`RM 250.00 / 3` → `8334 / 8333 / 8333`.

**4. Members are never deleted.** Only `is_active = false`. They stay on every bill
they already appear on and remain settleable. Do not add a delete endpoint or a delete
button. Same for groups (never deleted) and events (archived).

**5. The viewer's name is shown, never the bare word "You".** Render the real member
name plus a quiet "you" marker (`Sarah (you)`, or a chip / avatar ring). People
screenshot these screens into group chats — "Sarah owes RM 158.30" must be meaningful
to everyone who sees it. This applies to every screen including the settle-up graph.

**6. `member` and `user` are separate concepts.** `member.user_id` is nullable and
always NULL in v1. A member is an accounting entity (a name that owes money); a user is
an authenticated identity. Never merge them — this is what lets login be added later
without a migration.

**7. All database access goes through server code.** Never expose the Supabase anon key
to the browser for app data, and do not rely on Supabase RLS — there is no `auth.uid()`
in v1. Server validates the share-token session cookie, then queries.

**8. Share tokens: CSPRNG, ≥128 bits, base62.** Exchange the token for an `httpOnly`
session cookie on first visit and redirect to a clean URL — never leave the token in
the address bar. Validate `revoked_at` on every request, not just at exchange.

**9. `viewer` role is enforced server-side.** Hiding buttons is not access control.

**10. Settled bills are immutable.** Reject edits and deletes on
`status = 'settled'` at the API layer.

## Architecture notes

- The **settlement engine is a pure module** with no framework or DB imports. It takes
  net balances, returns transfers. Keep it that way — it is the highest-risk code and
  must stay trivially unit-testable.
- Net balance: `SUM(bills paid) − SUM(shares owed)`. All nets sum to zero.
- Debt simplification: greedy max-debtor to max-creditor matching. Preserves every
  member's net exactly; only reroutes who pays whom.
- Payer and participants are **independent** — someone can pay for a bill they aren't
  part of.
- Settlement is **group-scoped** in the schema (bills from several events can settle
  together) even though the v1 UI settles within one event.

## Conventions

- Zod schemas shared between client and server; one definition per entity.
- Design tokens live in `tailwind.config.ts` — never hardcode hex values in components.
- Money figures use `tabular-nums`.
- Server-side validation on every mutating endpoint, independent of the client.
- Wrap multi-row writes (bill + splits, settlement + transfers + bill status) in a
  transaction.
- Reference screens by their Screen Spec ID in commits and comments.

## Build order

Do not start with UI. Follow `docs/system-design.md` §10:

1. Prisma schema + migrations
2. **Settlement engine + Vitest suite** (see system-design §4.4 for required cases)
3. Groups, share links, session exchange
4. Members
5. Events + event membership
6. Bills with split validation
7. Settlement preview/confirm
8. UI, in Screen Spec order

## Commands

```
npm run dev            # dev server
npm run build          # production build
npm test               # vitest
npx prisma migrate dev # create + apply a migration
npx prisma studio      # inspect data
```

## Environment

`.env.local` (gitignored):

```
DATABASE_URL=            # Supabase pooled connection string
DIRECT_URL=              # Supabase direct connection (for migrations)
SUPABASE_SERVICE_KEY=    # server-side only, never exposed to the client
```

Supabase and Vercel both in Singapore (`ap-southeast-1`).
