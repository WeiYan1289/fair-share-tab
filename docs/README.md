# FairShareTab — Documentation

Everything needed to build FairShareTab. Read `../CLAUDE.md` first for the short
version; these documents are the detail.

## Files

| File | What it is | Read it when |
|---|---|---|
| `../CLAUDE.md` | Project memory. Stack, critical rules, build order. Claude Code loads this automatically every session. | Always. |
| `data-model.md` | Schema, fields, relationships, invariants, money handling. | Writing migrations or touching any entity. |
| `system-design.md` | Architecture, access control, API endpoints, algorithms, validation, build order. | Writing server logic or endpoints. |
| `FairShareTab - Screen Spec.md` | Every screen: ID, route, data read, actions, states. | Building any UI. |
| `FairShareTab - Mockups.dc.html` | Visual reference — open in a browser. | Building any UI. Read the HTML for exact colors and spacing. |
| `archive/` | Superseded designs. **Do not build from these.** | Never. |

## The short version

A **group** holds **members** and **events**. Events hold **bills**; bills hold
**splits** (one share per participating member). Settle-up nets everyone's balance and
reduces many bills to the fewest transfers.

Access is a **shareable link per group** — no accounts in v1, but the schema is built
so login can be added later without a migration.

## Ten rules that must not be broken

1. Money is **integers in the event currency's smallest unit**. Each event picks its
   own currency (default MYR) from a curated list — see `src/lib/currency.ts`.
   `RM 12.50` → `1250`; `¥1,500` → `1500` (JPY has zero decimal places).
2. **Splits always sum to the bill total** — validated server-side, in a transaction.
3. **Equal-split rounding is deterministic** — the remainder goes to the payer first,
   then by `created_at`.
4. **Members are never deleted** — deactivated only.
5. **Show the viewer's real name**, never the bare word "You".
6. **`member` and `user` are separate** — `member.user_id` is nullable, always NULL in
   v1.
7. **All DB access goes through server code** — no Supabase RLS, no anon key in the
   browser.
8. **Share tokens**: CSPRNG ≥128 bits, exchanged for an httpOnly cookie, never left in
   the URL.
9. **`viewer` role enforced server-side.**
10. **Settled bills are immutable.**

## Build order

1. Prisma schema + migrations
2. **Settlement engine + Vitest suite** — pure module, no DB, no UI. Do this second,
   before anything else touches money.
3. Groups, share links, session exchange
4. Members
5. Events + event membership
6. Bills with split validation
7. Settlement preview / confirm
8. UI, in Screen Spec order

## Setup

- Node.js 22+, Git
- Supabase project in `ap-southeast-1` (Singapore)
- `.env.local` with `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SERVICE_KEY` — gitignored
- Vercel project, same region

## Known gaps

Design decisions still open, listed so they don't get silently invented:

- **Audit log** of bill edits — not designed; worth adding early if disputes occur.
- **Concurrent edit conflicts** — v1 is last-write-wins.
- **Rate limiting is in-memory and per-process** (`src/lib/auth/rate-limit.ts`) —
  fine for a single warm instance, weak against a distributed attacker on a
  multi-instance serverless deployment. Login, register, group creation, and
  token lookup all share this limiter. Fixing it means a shared store (e.g.
  Upstash Redis); out of scope until it's actually load-bearing.
- **A registered user cannot save a pasted share link's group into their
  account** — deliberately unbuilt, not missing. `GroupMembership` already
  supports it with no schema change (it's an unlimited many-to-many), but doing
  so would let a membership survive link revocation — regenerating the link
  would stop being a complete access-revocation mechanism. Shipping it
  responsibly needs owner-side membership management alongside it.
- **A guest group creator who clears cookies (or uses "Exit group") permanently
  loses the ability to register and claim that group.** Claiming is driven by a
  signed, device-bound cookie (`fst_visitor_created_group`) set only at the
  moment of anonymous group creation — there's no clean fix without adding some
  form of identity for anonymous users, which would be a larger, separate
  feature. Accepted cost of the anonymous-first design.
