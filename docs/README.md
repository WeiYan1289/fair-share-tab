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

1. Money is **integers in sen**. MYR only. `RM 12.50` → `1250`.
2. **Splits always sum to the bill total** — validated server-side, in a transaction.
3. **Equal-split rounding is deterministic** — remainder sen go to the payer first,
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
- **Multi-currency** — schema supports it, but zero-decimal currencies (JPY) need
  parsing, display, and rounding work before enabling.
- **Concurrent edit conflicts** — v1 is last-write-wins.
