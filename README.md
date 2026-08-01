# FairShareTab

A group bill-splitting web app. Create a group, log bills as you go, and settle
up with the fewest possible transfers — no accounts or passwords required,
just a shareable link.

## What it does

- **Groups** hold members and events — a circle of friends, roommates, or family
- **Events** are trips or occasions, each with its own currency and running total
- **Bills** split evenly or by exact custom amounts, with deterministic rounding
  down to the cent
- **Settle up** collapses every bill in an event down to the smallest set of
  person-to-person transfers, so nobody sends more payments than they have to

Access is by shareable link only. Anyone with the link can view a group, and
an editable link lets them add and edit bills too — a view-only link is
available for anyone who should just be able to check balances.

## Tech stack

Next.js 15 (App Router) + TypeScript · Tailwind CSS · PostgreSQL (Supabase) ·
Prisma · Zod · Vitest · deployed on Vercel

## Getting started

```bash
npm install
npm run dev              # start the dev server
npm test                 # run the test suite
npx prisma migrate dev   # apply database migrations
```

Requires a `.env.local` with `DATABASE_URL`, `DIRECT_URL`, and
`SUPABASE_SERVICE_KEY` — see [CLAUDE.md](CLAUDE.md) for the full list and
project conventions.

## Documentation

- [`docs/data-model.md`](docs/data-model.md) — schema, fields, invariants
- [`docs/system-design.md`](docs/system-design.md) — architecture, access
  control, API, algorithms
- [`docs/FairShareTab - Screen Spec.md`](<docs/FairShareTab - Screen Spec.md>)
  — every screen, by ID
- [`CLAUDE.md`](CLAUDE.md) — critical correctness rules and build order
