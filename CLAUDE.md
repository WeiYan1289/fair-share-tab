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

**1. Money is integers in the smallest unit of the event's currency.** Each event
independently selects its currency (default MYR) from a curated list (MYR, SGD, JPY,
CNY, TWD, KRW, USD, THB, IDR, HKD, EUR, GBP, AUD) — see `src/lib/currency.ts`. JPY
and KRW have zero decimal places; every other currency in the list uses 2, so never
assume a division by 100. `RM 12.50` is stored and computed as `1250`; `¥1,500` and
`₩1,500` are stored and computed as `1500`. Never use float, never use
decimal-as-string. Convert to display only at the UI boundary
(`amount / 10 ** minorUnit`, `RM 1,240.00` / `¥1,500`).

**2. Splits must sum to the bill total.** `SUM(split.share_amount) === bill.total_amount`
for every bill, always. Validate on the server inside a transaction, on every create
and update. Client-side validation is UX only.

**3. Equal-split rounding is deterministic.** `base = floor(total / n)`, then
distribute the remainder in the currency's smallest unit one at a time — to the payer
first if the payer participates, then by `member.created_at`. Sum must equal total
exactly. `RM 250.00 / 3` → `8334 / 8333 / 8333`.

**4. Nothing is ever deleted, and archived means sealed.** Members only get
`is_active = false` — they stay on every bill they already appear on and remain
settleable. Events and groups both get `status = 'archived'`. Do not add a
delete endpoint or a delete button for any of them.

Archived is a read-only state, not a filter. An archived event rejects every
write with a 409; an archived group refuses every session, the owner included.
The only permitted action on either is restore, taken from the dedicated
archive screens (`/g/{groupId}/events/archived`,
`/account/groups/archived`) — which is why those screens are ruled lists rather
than cards, and why an archived item is never rendered as a card in the main
list. Enforce the seal server-side; hiding the buttons is not the gate.

Archiving is always reversible and never destroys data: restoring a group brings
its existing share links straight back to life, because archiving leaves
`revoked_at` untouched.

**5. Member names are shown plainly, identically to everyone with the link.**
No per-viewer identity is tracked anywhere in the app, so there is no "you" to
mark — access is granted purely by which link you opened, not by who you are.
People screenshot these screens into group chats — "Sarah owes RM 158.30" must
be meaningful to everyone who sees it, which a plain name already is.

**6. `member` and `user` are separate concepts.** `member.user_id` is nullable and
always NULL in v1. A member is an accounting entity (a name that owes money); a user is
an authenticated identity. Never merge them — this is what lets login be added later
without a migration.

**7. All database access goes through server code.** Never expose the Supabase anon key
to the browser for app data, and do not rely on Supabase RLS — there is no `auth.uid()`
in v1. Server validates the share-token session cookie, then queries.

**8. Share tokens: CSPRNG, ≥128 bits, base62.** Exchange the token for an `httpOnly`
session cookie on first visit and redirect to a clean URL — never leave the token in
the address bar. Validate `revoked_at` on every request, not just at exchange — and
`group.status` alongside it, for the same reason: a credential that was valid when
issued must be re-checked, not trusted.

**9. `viewer` role is enforced server-side.** Hiding buttons is not access control.
The same goes for owner-only actions (rename, archive, restore, share-link
regeneration): the menu item may be hidden for convenience, but the endpoint must
still 403. **The owner is the user holding the group's earliest `editor`
`group_membership`** — derived, never stored. `getGroupOwner` in
`src/lib/account.ts` is canonical; if you resolve it inline anywhere, keep the
`created_at ASC` ordering or you will silently promote the wrong editor.

**10. Settled bills are immutable.** Reject edits and deletes on
`status = 'settled'` at the API layer. There is no unsettle path and adding one is
its own design problem, not a quick fix: a settlement can cover several bills with
one already-computed set of transfers, so releasing a single bill would leave its
siblings' transfers wrong. Do not add a Lock icon, a disabled "unmark" button, or
copy implying the action can be reversed. Because it cannot be undone, the settle
confirmation requires an explicit "these payments have been made in real life"
acknowledgement before it will submit.

**11. Archiving hides money, so say so where the money is shown.** Archived events
are excluded from member expense and balance figures — filtered in the query
functions in `src/lib/expenses/`, never in components, so every tab agrees by
construction. `getMemberEventActivity` is the deliberate exception: it is scoped to
one event and reached from that event's own dashboard.

This only holds because rule 4's seal holds. Hiding an event's money while
still accepting writes to it means a new bill counts toward nobody's balance —
that was a real bug, not a hypothetical, and the seal is what fixes it. If you
ever relax one, you have reintroduced the other.

Two consequences that are easy to get wrong: any UI copy claiming to cover
"every event" becomes false the moment an archived event holds unsettled money —
scope the wording and say archived events are not counted; and archiving is
allowed even with unsettled bills, so the confirmation must state the count and
amount being hidden, plus that the event cannot be settled while archived.

**12. Password reset has four invariants that break silently.** Each one
looks fine in the browser when violated, which is why they are listed here
rather than left to code review.

- **`POST /api/auth/forgot` returns one identical response** — same body,
  same status, same duration — whether the email matched, did not match, or
  was throttled. Any observable difference is a user-enumeration oracle.
  This is why the mail send and the token write both run inside `after()`
  and the token is generated *before* the user lookup: so both branches do
  the same work on the request path.
- **Reset links are built from `APP_URL`, never from the request `Host`
  header.** `Host` is attacker-controlled; deriving the link from it lets a
  forged header make the server email a victim a link to the attacker's
  domain. An unset `APP_URL` throws rather than falling back.
- **Every password change sets `user.password_changed_at`.** Both session
  cookies carry an `issuedAt` and re-check it on every request — including
  `fst_session`'s `kind: "member"` variant, not just `fst_user_session`.
  A password change leaves `group_membership` untouched, so without that
  check an attacker holding a group cookie keeps editor access after the
  owner resets. A cookie with no `issuedAt` is rejected, not trusted.
- **Reset tokens are stored as SHA-256, single-use, and a successful reset
  invalidates every other outstanding token for that user.** SHA-256 rather
  than Argon2id only because the lookup is *by* token and needs a
  deterministic digest — safe solely because the token carries ~190 bits of
  entropy. Never apply that reasoning to anything user-chosen.

Per-account rate limiting (60s cooldown, 5/24h) is DB-backed against
`password_reset_token` on purpose: the in-memory limiter in
`src/lib/auth/rate-limit.ts` does not survive serverless, so it cannot be
what this feature's abuse resistance rests on. See `docs/data-model.md`
§3.11.

**13. Receipts are optional, compressed, and never load-bearing.** A bill may
carry one receipt image in `bill.receipt_url`. Four things about it are
correctness requirements, not preferences:

- **Never call `list()` or `head()` from `@vercel/blob`.** Both are billed
  operations against a Hobby allowance that, once exceeded, blocks Blob
  entirely for 30 days. The URL lives on the `Bill` row and that is the only
  lookup path.
- **Compression is mandatory.** `compressReceipt` downscales to a 1600px JPEG
  in the browser and throws rather than falling back to the original bytes.
  Without it every quota figure divides by roughly 13.
- **Fail soft in both directions.** An upload failure still saves the bill; a
  read failure hides the receipt block entirely. Nothing in the money path —
  bills, splits, balances, settlement — may depend on Blob being reachable, so
  a total outage costs the app nothing but receipts. `ReceiptThumbnail` needs
  both an `onError` handler *and* a mount-time `complete && naturalWidth === 0`
  check: the `<img>` is server-rendered, so a load that fails before hydration
  fires its error event with no listener attached and leaves a broken icon on
  screen. That was a real bug, not a hypothetical.
- **Receipts render on the bill detail view only**, never in the event
  dashboard's bill list — a thumbnail per row multiplies data transfer by the
  length of the list.

Removing a receipt nulls the column and leaves the blob in storage. That is not
a violation of rule 4, which governs accounting entities whose disappearance
would corrupt a balance; a receipt is an attachment and removing it changes no
money. It also means removal cannot fail while Blob is unreachable.

Settled and archived need no receipt-specific code: `receiptUrl` travels in the
same request body as every other bill field, so rules 10 and 4 already cover it.

See `docs/data-model.md` §3.6, `docs/system-design.md` §5 "Receipts", and
Screen Spec P5-01 / P5-03.

## Architecture notes

- The **settlement engine is a pure module** with no framework or DB imports. It takes
  net balances, returns transfers. Keep it that way — it is the highest-risk code and
  must stay trivially unit-testable.
- Net balance: `SUM(bills paid) − SUM(shares owed)`. All nets sum to zero.
- Debt simplification: greedy max-debtor to max-creditor matching. Preserves every
  member's net exactly; only reroutes who pays whom.
- Payer and participants are **independent** — someone can pay for a bill they aren't
  part of.
- Settlement is **group-scoped, single-currency**. A settlement always belongs to a
  group (`Settlement.groupId` non-null) and covers exactly one currency. It comes in
  two shapes: **event-scoped** (`eventId` set — one event's bills, the original flow)
  and **cross-event** (`eventId` null — the union of several same-currency events'
  bills, netted once). The single-currency guarantee is by construction for the event
  case and server-enforced for the cross-event case
  (`computeGroupSettlementPreview`, which also rejects archived/foreign-group bills).
  The pure engine is unchanged either way — cross-event just feeds it more bills,
  pre-partitioned to one currency. Settlement never spans more than one currency.

## Conventions

- Zod schemas shared between client and server; one definition per entity.
- Design tokens live in `tailwind.config.ts` — never hardcode hex values in components.
- Money figures use `tabular-nums`.
- Server-side validation on every mutating endpoint, independent of the client.
- Wrap multi-row writes (bill + splits, settlement + transfers + bill status) in a
  transaction.
- Reference screens by their Screen Spec ID in commits and comments.
- **User-facing actions signal through the app-wide toast system**, not inline
  notices alone. Call `useToast()` from `src/components/ui/toast/ToastProvider.tsx`
  (mounted once in `src/app/layout.tsx`): `toast(message)` on success,
  `toast(describeApiError(res.status, body), "error")` in a `!res.ok` branch, and
  `toast(NETWORK_ERROR_MESSAGE, "error")` in a transport `catch`. `describeApiError`
  (`src/components/ui/toast/error-message.ts`) renders `"{status} · {server
  message}"`, so reuse the `body` the call site already parsed — never read the
  `Response` twice. Keep existing inline error copy; the toast is an added global
  signal, not a replacement. Before a `window.location.href` full reload (create /
  restore group), use `queueToast(...)` (sessionStorage) so the toast survives the
  reload instead of the live `toast()`. Toasts use design tokens only. Auth forms
  (login/register/forgot/reset) are deliberately excluded.
- **The desktop workspace adds bills through a modal, not an inline column.** The
  `Add a bill` chip opens `AddBillModal`, which renders `BillForm` with the
  `embedded` prop — that prop strips the form's full-page wrapper and header
  (ThemeToggle + heading + close) so the modal owns the frame. The standalone
  `/bills/new` route renders `BillForm` **without** `embedded` and must stay
  byte-for-byte unchanged when touching that component.
- **Vitest covers pure/isolable logic only** — crypto/signing helpers, Zod schemas,
  the settlement engine, and small decision predicates (e.g. `src/lib/auth/
  share-link-access.ts`). There is no route-handler or component test harness.
  A function that must touch Prisma to be meaningful (e.g. `getGroupOwner` in
  `src/lib/account.ts`) takes its client as an injectable parameter, defaulting to
  the real `prisma` import, so a test can pass a minimal fake instead — the same
  pattern `claimVisitorGroup` (`src/lib/auth/claim.ts`) established. Route wiring and
  UI are verified by hand against a running dev server, not with a new test style.

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

`build` runs `prisma generate` first, and must keep doing so. The generated
client is written to `src/generated/prisma`, which is gitignored, and Prisma 7
has no `postinstall` hook — so on a fresh clone (every Vercel build) nothing
else creates it and `src/lib/prisma.ts` fails to resolve its import. It does
not touch the database; it only reads the schema and emits TypeScript.

## Deployment

Vercel, with build and output settings left at their defaults — the only
required override is the `build` script above, which lives in `package.json`
so local, CI, and Vercel all behave identically.

`vercel.json` pins functions to `sin1` (Singapore) to sit beside the Supabase
instance. Without it, functions default to `iad1` (Washington DC) and every
query crosses the Pacific — and since most pages issue several *sequential*
queries, that round trip compounds per request rather than being paid once.

Migrations are never run by the build. Apply them deliberately with
`npx prisma migrate deploy`, which connects via `DIRECT_URL` — migrations
cannot run through the pooler.

## Environment

`.env.local` (gitignored). `.env.example` is the annotated list and the
source of truth — copy it rather than reconstructing the set from here,
since a partial list in two places is how a variable goes missing.

Required to run: `DATABASE_URL` (pooled), `DIRECT_URL` (direct, for
migrations), `SESSION_SECRET`. Password reset adds `MAILER` / `APP_URL`
(plus `RESEND_API_KEY` and `EMAIL_FROM` when `MAILER=resend`), and
receipts add `BLOB_READ_WRITE_TOKEN` — which no code here names, because
the `@vercel/blob` SDK reads it from the environment itself.

Supabase and Vercel both in Singapore (`ap-southeast-1`).
