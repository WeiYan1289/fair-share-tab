# FairShareTab

Split group trip costs fairly, then settle up in the fewest possible transfers.
No accounts, no passwords — a group is a shareable link.

Five people spend a fortnight covering for each other and end up with a
tangle of a dozen IOUs nobody wants to unpick. FairShareTab logs the bills as
they happen and collapses the whole mess into the smallest set of
person-to-person payments that leaves everyone exactly square.

## How it's put together

A **group** is the container — a circle of friends, roommates, a family. It
holds **members** and **events**.

An **event** is one trip or occasion, with its own currency and its own
running total. Every active group member joins automatically.

A **bill** is what it was for, the total, who paid, and who it's split
between. Payer and participants are independent: someone can pay for a bill
they aren't part of. Splits are even or exact amounts, and a bill can carry a
photo of the receipt.

**Settling up** nets every selected bill in an event down to the fewest
transfers and marks them paid.

## The ideas behind it

**A link is the whole account.** There is nothing to sign up for. Creating a
group hands you a link; whoever holds it is in. An editor link can change the
money, a view-only link can only look, and both are enforced on the server
rather than by hiding buttons. An account is optional on top of that — it
makes you the group's owner, and lets you hold more than one group.

**The money has to be exactly right.** Every amount is an integer in the
currency's smallest unit, never a float. Splits are checked against the bill
total inside a transaction on every write. Equal-split rounding is
deterministic: the remainder goes to the payer first, then by join order, so
RM 250 across three people is 83.34 / 83.33 / 83.33 and never 83.33 three
times with a cent missing.

**One event, one currency.** Each event picks its own from a curated list of
thirteen, and settlement is always scoped to a single event — so there is
never a conversion to argue about, and never a settle-up that silently mixes
currencies. Yen and won are stored without decimals, because they don't have
any.

**Settling is final.** Confirming a settle-up locks those bills read-only for
good, which is exactly what makes the history worth trusting. Because it
can't be undone, the confirmation asks you to tick that the payments really
happened in real life.

**Nothing is ever deleted.** Members deactivate rather than disappear, and
stay on every bill they already appear on. Events and groups archive. Links
revoke. Archiving is a seal, not a filter: an archived event drops out of
everyone's balances *and* stops accepting changes, and an archived group
stops opening for everyone including its owner. Share links go quiet rather
than break, and start working again the moment the group is restored.

**Names are shown plainly, the same to everyone.** No per-viewer identity is
tracked anywhere, so there is no "you" to highlight — access comes from which
link you opened, not from who you are. People screenshot these screens into
group chats, and "Sarah owes RM 158.30" has to mean something to everyone who
sees it.

## Under the hood

The settlement engine is a pure module with no framework or database imports.
It takes net balances and returns transfers, matching the largest debtor to
the largest creditor until everyone is at zero. It preserves every member's
net exactly and only reroutes who pays whom. It is the highest-risk code in
the project, so it stays trivially unit-testable.

Net balance is `SUM(bills paid) − SUM(shares owed)`, and all nets sum to zero.

Built with Next.js 15 (App Router), TypeScript, Tailwind CSS, PostgreSQL via
Prisma, Zod, and Vitest. Deployed on Vercel.

## Documentation

- [`docs/data-model.md`](docs/data-model.md) — schema, fields, invariants
- [`docs/system-design.md`](docs/system-design.md) — architecture, access
  control, API, algorithms
- [`docs/FairShareTab - Screen Spec.md`](<docs/FairShareTab - Screen Spec.md>)
  — every screen, by ID
- [`CLAUDE.md`](CLAUDE.md) — correctness rules, conventions, and commands
- [`.env.example`](.env.example) — every environment variable, annotated
