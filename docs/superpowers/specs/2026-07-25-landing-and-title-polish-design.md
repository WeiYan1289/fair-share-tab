# Landing page cleanup, generic event wording, settlement demo scale-up, header centering fix

## Context

Four small, independent UI enhancements requested after using the app:

1. `EventsListView` labels every event a "trip" (`"{n} trips together"`), but
   events aren't necessarily trips — could be "Day 1 of something," a shared
   flat, etc. Confirmed live: created a test event named "Day 1 Groceries"
   and it rendered "1 trip together" underneath, and the create-event modal's
   placeholder is `"Ski Trip 2026"` — both nudge users toward trip-shaped
   names even when the event isn't a trip.
2. The landing page's "I have an invite link →" toggle + paste-link panel is
   now redundant: pasting a group URL directly into the browser already
   routes in via `src/app/g/[groupId]/route.ts`. Confirmed: `PasteLinkPanel`
   has no other callers, so it can be deleted outright.
3. The landing page's settlement-demo illustration (3 payers → 1 "YOU") is
   too simple to show off what the settlement engine actually does. Wanted:
   a bigger example — more payers than receivers, several transfers — that
   reads as a "hard case" the app collapses down to a small transfer count.
4. User noticed page titles aren't always centered. Investigated live:
   list/detail screen `h1`s (Events list, Event dashboard) are left-aligned
   by design, with stats/actions on the right of the same row — that's
   intentional and stays. But `GroupHeader` (the shared nav bar rendered on
   every in-group screen: `EventsListView.tsx:59`, `EventDashboard.tsx:83`)
   lays out Logo (left) / group name (middle) / `ThemeToggle` (right) as a
   3-item `flex justify-between` row, and the middle item is *not* actually
   centered on the page — measured live at 1272px viewport width: page
   center is 636px, but the group-name label's center sits at 688px, a 52px
   rightward drift. This happens because `justify-between` only guarantees
   equal gaps between adjacent items, and Logo (~130px wide) is wider than
   `ThemeToggle` (~40px wide) — the two outer items would need equal width
   for the middle item to land on true center. This is the one real bug;
   everything else about title alignment is an intentional list-vs-moment
   split and stays as-is.

## 1. Generic event wording

- `src/components/events/EventsListView.tsx:75` — change
  `` {events.length} trip{events.length === 1 ? "" : "s"} together `` to
  `` {events.length} event{events.length === 1 ? "" : "s"} ``.
- `src/components/events/EventsListView.tsx:130` — change the empty-state
  copy from `"Create an event for your next trip to start splitting bills
  with friends and family."` to `"Create an event to start splitting bills
  with friends and family."` (drop "for your next trip").
- `src/components/events/CreateEventModal.tsx:65` — change the event-name
  input placeholder from `"Ski Trip 2026"` to `"Day 1 — Groceries"`, an
  example that doesn't read as trip-specific.

No other "trip" language exists in this component (checked
`EmptyState`'s viewer-only copy and `EventCard` — neither mentions trips).

## 2. Remove paste-link entry from landing page

- Delete `src/components/landing/PasteLinkPanel.tsx`.
- In `src/components/landing/Landing.tsx`:
  - Remove the `import { PasteLinkPanel } from "./PasteLinkPanel";` line.
  - Remove the `showPasteLink` state and its setter.
  - Remove the `"I have an invite link →"` toggle `<button>` and the
    `{showPasteLink && <PasteLinkPanel ... />}` block.
- Everything else in the hero column (heading, subtext, "Create a group"
  button, "See how it works →" link) stays, now with one less interactive
  element between the CTA and the tutorial link.

## 3. Settlement demo: 5 payers → 3 receivers, 5 transfers

Replace the current 3-payer/1-receiver mock with an 8-person example (5
paying, 3 receiving) that resolves in exactly 5 transfers — chosen so the
numbers are internally consistent with how the real settlement engine
(`docs/system-design.md` §4.4 greedy max-debtor/max-creditor matching)
would actually resolve them, not just visually plausible:

**Debtors (left, owe money):** AR 500, KM 250, HZ 100, DV 100, NF 50
(sums to 1000)
**Creditors (right, owed money):** PS 500, JI 350, SM 150 (sums to 1000)

Running greedy max-debtor↔max-creditor matching by hand gives exactly 5
transfers, including two clean simultaneous zero-outs (a debtor and
creditor fully cancel in the same transfer — a nice visual for "the engine
found the efficient path"):

1. AR → PS 500 (both fully settled)
2. KM → JI 250
3. HZ → SM 100
4. DV → JI 100 (both fully settled)
5. NF → SM 50 (both fully settled)

Implementation (`src/components/landing/Landing.tsx`):
- Replace `HERO_PEOPLE` with two arrays, `PAYERS` (5 entries: initials,
  color, vertical position) and `RECEIVERS` (3 entries), plus a `TRANSFERS`
  array of `{ from, to, amount }` pairs (the 5 listed above) driving both
  the arrow paths and the amount badges — so the visual is generated from
  one data source instead of positional coincidence.
- 5 payer avatars stack down the left edge, evenly spaced (mirrors the
  existing avatar styling: colored circle, initials, white bold text).
  Reuse the 3 existing hex colors for AR/KM/HZ and add 2 more swatches for
  DV/NF, consistent with the existing hardcoded-hex approach in this file
  (not moved to design tokens — out of scope for this change, and the
  existing 3 colors already follow this pattern here).
- 3 receiver avatars on the right replace the single "YO" bubble — reuse
  the existing right-side vertical positions (15%/50%/85%) since 3 items at
  those slots is exactly what the old left column used. Give each a
  distinct color so they read as different people, not "you."
- 5 curved SVG arrow paths (same `heroArrow` marker technique already in
  place), each drawn from its payer's position to its receiver's position
  per the `TRANSFERS` mapping above (PS receives 1 incoming arrow, JI and
  SM each receive 2 — a realistic fan-in, not one-to-one).
- Amount badges follow their arrow (`RM 500`, `RM 250`, `RM 100`, `RM 100`,
  `RM 50`), positioned along each path similar to the current
  midpoint-badge placement.
- The card's SVG viewBox/aspect ratio grows taller to fit 5 rows on the
  left without cramping (was `420/230`; widen vertical room accordingly,
  exact ratio decided during implementation to keep the 5 rows evenly
  spaced and legible at the card's existing width).
- Footer chip text changes from `"3 transfers settle everyone"` to
  `"5 transfers settle everyone"`.
- Card header label (`"Settle up — the signature moment"`) is unchanged.

This stays a hand-built SVG mock (no real screenshot, no live app data) —
confirmed approach: keeps the landing page fast and independent of seed
data, and matches the existing visual language instead of introducing a
second style (a real screenshot).

## 4. Fix `GroupHeader` centering

`src/components/group/GroupHeader.tsx` changes from a 3-item
`flex justify-between` row to a `grid grid-cols-3 items-center` row:

- Left cell: `<Logo ... />`, `justify-self-start`.
- Middle cell: the group-name `<span>`, `justify-self-center text-center`,
  plus `truncate` (with `min-w-0` on the cell) so a long group name doesn't
  overflow into the side cells now that its column has a fixed 1/3 width
  budget instead of shrink-to-fit space.
- Right cell: `<ThemeToggle />`, `justify-self-end`.

Equal-width columns make the middle cell genuinely centered on the page
regardless of Logo/ThemeToggle width — the fix that closes the 52px drift
measured above. This is the only component using this 3-item pattern
(`BillForm.tsx` and `SettleUpFlow.tsx` have their own simpler 2-item header
rows with no centered middle element, confirmed via search — not touched).

## Out of scope (explicitly confirmed)

- No change to the left-vs-centered `h1` convention across screens (list
  pages left-aligned, empty-state/settle-result screens centered) — that
  split is intentional.
- No Logo visual redesign — only the `GroupHeader` layout bug above.
- No real-screenshot-based settlement demo — SVG mock only.
- No fallback/minimal version of the paste-link entry — full removal.
