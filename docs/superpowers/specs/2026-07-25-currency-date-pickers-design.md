# Currency picker, date-range picker, and app-wide icon replacement

## Context

Two reported issues, both in `CreateEventModal` (Screen Spec P3-04), the only
place currency and event dates are currently editable — `updateEventSchema`
supports patching dates too, but no UI calls it yet, so that path stays
out of visual scope here (only its validation gets touched, see below):

1. The currency `<select>` is a bare native dropdown: no flags, and the
   browser's default arrow renders inconsistently (looks odd against the
   app's custom border/radius styling, especially in dark mode).
2. The two `<input type="date">` fields (start/end) are independent — nothing
   stops picking a start date after the end date. `startDate`/`endDate` are
   already optional end-to-end (`docs/data-model.md` lines 180-181,
   `createEventSchema`/`updateEventSchema` in `src/lib/validation/event.ts`),
   so this is a UI-only gap, not a schema change.

Confirmed with the user (in order):
1. Use **react-aria-components** (headless, unstyled, accessible) for both
   pickers rather than a full component kit like Ant Design/Mantine — a full
   kit ships its own visual language (colors, radii, shadows) that would
   fight the app's Tailwind-token design system (CLAUDE.md: "Design tokens
   live in `tailwind.config.ts` — never hardcode hex values in components").
   react-aria-components gives keyboard nav, focus trapping, and (critically
   for the date bug) built-in min/max date constraints for free, styled
   entirely with existing Tailwind classes.
2. Currency flags: **SVG flags via the `flag-icons` package**, not emoji.
3. While in there: **replace all emoji used as UI icons app-wide with
   `lucide-react`** SVG icons — the user dislikes the emoji visual style in
   general, not just for currency flags.
4. Date-range bug fix: **live constraint** — picking a start date must
   narrow what's selectable as the end date (and vice versa) so the invalid
   state is unreachable in the UI, not just caught at submit time.
5. Dates stay optional with **no clear/× affordance** — out of scope. Add a
   short "optional" hint under the label instead so the user knows they can
   skip it.

## New dependencies

- `react-aria-components` — headless `Select`/`ListBox` (currency) and
  `DateRangePicker`/`RangeCalendar` (event dates). Supports React 19.
- `@internationalized/date` — `CalendarDate`/`DateValue` types
  react-aria's date components require; used to convert to/from the `YYYY-MM-DD`
  ISO strings the API and Zod schemas already use.
- `lucide-react` — icon set replacing emoji.
- `flag-icons` — CSS/SVG flag set, `<span class="fi fi-my">` per ISO
  alpha-2 country code.

## Currency picker

`src/lib/currency.ts`: add a `country: string` field (lowercase ISO
alpha-2) to `CurrencyMeta` and to every entry in `CURRENCIES`:

| code | country | code | country | code | country |
|------|---------|------|---------|------|---------|
| MYR  | my      | TWD  | tw      | HKD  | hk      |
| SGD  | sg      | USD  | us      | EUR  | eu      |
| JPY  | jp      | THB  | th      | GBP  | gb      |
| CNY  | cn      | IDR  | id      | AUD  | au      |

(`flag-icons` ships an `eu` flag for the European Union, used for EUR since
the currency isn't tied to one country.)

New `src/components/ui/CurrencySelect.tsx`: wraps react-aria's `Select` +
`ListBox` + `ListBoxItem` + `Popover`. Trigger button matches the existing
input chrome (`rounded-md border border-ink/14 bg-cream px-3.5 py-3`, dark
variants) and renders: flag span + currency code + a `lucide-react`
`ChevronDown` at the trailing edge. Each popover row renders: flag span +
code + full label (mirrors the current `"{code} — {label}"` text). Props:
`value: string`, `onChange: (code: string) => void` — same shape as the
native `<select>` it replaces, so `CreateEventModal` swaps it in without
changing its own state.

## Event date-range picker

New `src/components/ui/EventDateRangeField.tsx`: wraps react-aria's
`DateRangePicker` + `RangeCalendar` (single popover, one calendar, range
selection). Props: `value: { start: string; end: string } | null`,
`onChange: (value: { start: string; end: string } | null) => void` — ISO
date strings in and out, converting to/from `CalendarDate` internally via
`@internationalized/date`, so `CreateEventModal` keeps its own two
`startDate`/`endDate` string states and only translates at the boundary of
this component (mirrors how `CurrencySelect` stays a drop-in swap).

Trigger shows the formatted range (`Jul 25 – Aug 2`) or a placeholder
("No dates set") when null, plus a `lucide-react` `CalendarRange` icon.
Below the label: `Optional — for your own reference.` Because start/end
are chosen as one range gesture on one calendar, `RangeCalendar`'s built-in
constraint makes "end before start" unreachable in the UI — this is the
actual fix, not an added validation message.

`CreateEventModal` replaces its two side-by-side date `<input>`s with one
`EventDateRangeField`, keeping the existing `startDate || undefined` /
`endDate || undefined` behavior when submitting.

## Server-side defense in depth

`src/lib/validation/event.ts`: add a cross-field `.refine` to both
`createEventSchema` and `updateEventSchema` rejecting the case where both
dates are present and `startDate > endDate`. The UI makes this unreachable
through `CreateEventModal`, but CLAUDE.md's rule that "client-side
validation is UX only" applies to this pair too, and `updateEventSchema`
(the PATCH path) has no picker in front of it yet at all — a future
edit-event UI, or a direct API call, must not be able to persist an
inverted range.

## Icon replacement (app-wide)

Import `flag-icons/css/flag-icons.min.css` once, in `src/app/globals.css`.

Replace every emoji used as a UI icon with the `lucide-react` equivalent,
sized/colored via the surrounding element's existing Tailwind classes
(`text-*`, `w-*`/`h-*` as needed to match current visual weight):

| emoji | file(s) | lucide icon |
|-------|---------|--------------|
| 🔗 | `EventDashboard.tsx`, `ShareDialog.tsx` | `Link` |
| 🧾 | `EventDashboard.tsx` (empty-bills state) | `Receipt` |
| 🔒 | `EventDashboard.tsx`, `BillForm.tsx` (×2, locked-bill view) | `Lock` |
| ✎ | `EventDashboard.tsx`, `MemberChip.tsx` | `Pencil` |
| 🗑 | `EventDashboard.tsx` | `Trash2` |
| ⚠ | `BillForm.tsx` (custom-split mismatch warning) | `TriangleAlert` |
| ✓ | `BillForm.tsx`, `ShareDialog.tsx`, `SettleUpFlow.tsx` (×2), `Landing.tsx` | `Check` |

Plain text glyphs that aren't pictographic emoji (`+`, `×` used as a close
button, `←`) are out of scope — the user's objection is to the emoji visual
style specifically, not to all Unicode symbols.

## Testing

- `src/lib/currency.test.ts`: extend to assert every `CURRENCIES` entry has
  a `country` field matching `/^[a-z]{2}$/` (mirrors the existing
  code-format assertion).
- `src/lib/validation/event.test.ts`: add cases —
  `createEventSchema` rejects `startDate > endDate` when both present,
  accepts them when `startDate <= endDate` or when only one/neither is set;
  same three cases for `updateEventSchema`.
- No changes to the settlement engine or other pure logic — this work is
  UI plus one validation refinement, so no new Vitest suites beyond the two
  above.

## Out of scope

- No edit-event UI is being built; `updateEventSchema`'s new refine is
  defense-in-depth only, unreachable via any current screen.
- No clear/× control for an already-set date.
- No change to non-pictographic glyphs (`+`, `×`, `←`).
- No visual redesign beyond swapping the two form controls and the emoji
  icons — layout, copy, and spacing elsewhere in `CreateEventModal` and the
  six touched files stay as-is.
