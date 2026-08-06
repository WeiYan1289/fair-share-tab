# Rename & Archive: groups list rename, archived events, archived groups

**Date:** 2026-08-06
**Status:** Approved

Three independent features, built as three branches/PRs off `main`, in
order A → B → C. Each is self-contained and independently revertable.

A fourth request — unsettling a settled bill — was **explicitly dropped**
during brainstorming. CLAUDE.md rule 10 (settled bills are immutable)
stands unchanged; nothing in this spec weakens it.

---

## A. Group rename (groups list page)

Mirror the event rename feature commit-for-commit in shape.

- **UI:** each group card in `MyGroupsView` (`src/components/account/
  MyGroupsView.tsx`) gains an overflow menu rendered as a *sibling* of the
  card's `Link`, not a child — `<a>` may not contain a `<button>` under
  HTML's interactive content model (same reasoning as
  `EventsListView`). The menu's only entry for now: **Rename**, opening a
  new `RenameGroupModal` (pattern-copy of `RenameEventModal`).
- **API:** `PATCH /api/groups/{id}` accepts `{ name }` (Zod-validated,
  trimmed, non-empty). Gated to the **group owner** — resolved with the
  existing `getGroupOwner` in `src/lib/account.ts` (earliest editor
  `GroupMembership`), the same gate share-link regeneration uses.
  Non-owners get 403; the menu simply isn't rendered for them (but the
  server check is the real gate — rule 9).
- **Scope guard:** rename touches no amounts, splits, or settlements; no
  money invariants are in play.

## B. Archived events UI

`EventStatus` already has `archived`, and `PATCH /api/events/{id}`
already accepts a `status` change. This feature is the front door plus
the exclusion rule.

- **Archive action:** editor-only entry in the event card's existing
  overflow menu in `EventsListView`. Before archiving, count the event's
  unsettled bills:
  - 0 unsettled → simple confirm.
  - N > 0 → warning modal: "N unsettled bills will be hidden from
    balances until restored." **Warn but allow** (user's explicit
    choice). The count is computed server-side and rendered in the modal.
- **Archived section:** a collapsed "Archived" section at the bottom of
  the events list, listing archived events. Each has a **Restore**
  action (editor-only; sets `status` back to `active` via the same
  PATCH). Archived events remain navigable read-style — archiving hides
  them from math, it does not lock the pages beyond what their bill
  statuses already do.
- **Exclusion everywhere:** member expense details, balances, and event
  activity all exclude archived events. Implemented once at the lib
  layer — the queries feeding `src/lib/expenses/index.ts` and the
  balance/activity computations filter on `event.status = 'active'` — so
  every member tab agrees by construction. No tab-by-tab filtering in
  components.
- **Settlement note:** settlement stays event-scoped and is only
  reachable from inside an event, so no settlement-path changes are
  needed; an archived event's settled history is simply hidden with the
  event until restore.

## C. Archived groups (registered owner only)

- **Migration:** add `GroupStatus` enum (`active | archived`) and
  `Group.status` with default `active` — the same pattern `Event` uses.
  One migration, no backfill needed (default covers existing rows).
- **UI:** in `MyGroupsView`, the overflow menu from feature A gains
  **Archive** — rendered only when the viewing user is the group's
  owner. A collapsed "Archived" section at the bottom of the groups list
  shows archived groups with **Restore**. Both actions are
  server-enforced owner-only (403 otherwise).
- **Link gate:** two enforcement points, both server-side:
  1. **Token exchange** (first visit via share link): if the group is
     archived, do not mint a session; render the explanation page.
  2. **Every request** with an existing group-session cookie
     (`require-session` path): re-check `group.status`, mirroring how
     `revoked_at` is validated on every request rather than only at
     exchange (rule 8's discipline applied to a new field).
- **Visitor experience:** a friendly "This group has been archived by
  its owner" page — not a 404. The visitor already had legitimate
  access; the message leaks nothing new and prevents confusion.
- **Restore semantics:** restore flips `status` back to `active` and
  nothing else. Share-link tokens are never touched, so the *same* links
  work again immediately — no re-sharing needed.
- **While archived:** the owner still sees the group on the groups page
  (that is where Restore lives), and only the owner can reach its inner
  pages. Everyone else — including registered non-owner members — gets
  the explanation page until restore.

---

## Decisions log (from brainstorming)

| Question | Decision |
| --- | --- |
| Unsettle settled bills? | **Dropped** — rule 10 unchanged |
| Archived events excluded from which member views? | All of them — expenses, balances, activity |
| Archive an event with unsettled bills? | Warn (with count) but allow |
| Who archives/restores groups? | Owner only (`getGroupOwner`) |
| Link visitor hitting an archived group sees | Explanation page, not 404 |
| Delivery | Three branches/PRs: A → B → C |

## Testing

Per CLAUDE.md conventions: Vitest for pure/isolable logic only — the
archived-exclusion filter predicate and any new Zod schemas (group
rename payload, group status). The owner gate reuses `getGroupOwner`,
already testable via its injectable client. Route wiring and all UI
(menus, modals, archived sections, the explanation page) are verified by
hand against a running dev server across the role matrix: owner /
registered non-owner / editor link / viewer link, on active and archived
targets.
