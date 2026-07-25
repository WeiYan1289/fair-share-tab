# Currency Picker, Date-Range Picker, and Icon Replacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the native currency `<select>` and the two independent date
`<input type="date">` fields in `CreateEventModal` with accessible,
Tailwind-styled headless components that fix the start-date-after-end-date
bug by construction, and replace every emoji used as a UI icon app-wide with
`lucide-react` SVG icons.

**Architecture:** Two new presentational components in `src/components/ui/`
(`CurrencySelect`, `EventDateRangeField`) wrap `react-aria-components`
primitives (`Select`/`ListBox` and `DateRangePicker`/`RangeCalendar`), styled
entirely with the app's existing Tailwind classes — no new visual language.
Both keep the same controlled-prop shape their native predecessors had
(`value`/`onChange`), so `CreateEventModal` swaps them in with minimal state
changes. A cross-field Zod `.refine` on both event schemas adds server-side
defense-in-depth for the date-order rule. Six other components get a
mechanical emoji→`lucide-react` icon swap, no layout changes.

**Tech Stack:** Next.js 15 / React 19 / TypeScript, `react-aria-components`
(headless UI primitives), `@internationalized/date` (date-value types for
the range picker), `lucide-react` (icon set), `flag-icons` (SVG country
flags), Tailwind CSS 4, Zod, Vitest.

## Global Constraints

- Design tokens live in `tailwind.config.ts` — never hardcode hex values in
  new components (spec, "Confirmed with the user" §1).
- No full component kit (Ant Design, Mantine, etc.) — headless
  `react-aria-components` only, styled with existing Tailwind classes
  (spec §1).
- Currency flags and all replaced UI icons are SVG (`flag-icons`,
  `lucide-react`), not emoji (spec §2, §3).
- The date-range bug fix must make "end before start" **unreachable in the
  UI**, not just caught by a validation message (spec §4).
- Dates stay optional; no clear/× control is added — a short "optional"
  hint under the label is sufficient (spec §5).
- Server-side validation stays independent of client-side UI — CLAUDE.md:
  "Client-side validation is UX only."
- Only pictographic emoji used as icons are in scope. Plain glyphs (`+`,
  `×`, `←`, `↗`) are explicitly out of scope (spec, "Icon replacement").
- No edit-event UI is being built in this plan — the `updateEventSchema`
  refine is defense-in-depth only.

---

### Task 1: Install dependencies and wire up flag-icons CSS

**Files:**
- Modify: `package.json` (via `npm install`)
- Modify: `src/app/globals.css`

**Interfaces:**
- Produces: `react-aria-components`, `@internationalized/date`,
  `lucide-react`, `flag-icons` available as imports for all later tasks.
  `flag-icons` CSS classes (`fi`, `fi-<cc>`) available globally for Task 4.

- [ ] **Step 1: Install the four new dependencies**

Run:
```bash
npm install react-aria-components @internationalized/date lucide-react flag-icons
```

Expected: `package.json` `dependencies` gains all four packages;
`package-lock.json` updates; no peer-dependency warnings (all four support
React 19).

- [ ] **Step 2: Import flag-icons CSS globally**

Edit `src/app/globals.css` — add the import as the second line, right after
the Tailwind import:

```css
@import "tailwindcss";
@import "flag-icons/css/flag-icons.min.css";
@config "../../tailwind.config.ts";
```

- [ ] **Step 3: Verify the build succeeds**

Run: `npm run build`
Expected: build completes with no errors (this only proves the new CSS
import and installed packages don't break the build — nothing consumes them
yet).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/app/globals.css
git commit -m "chore: add react-aria-components, lucide-react, and flag-icons"
```

---

### Task 2: Add a country code to each curated currency

**Files:**
- Modify: `src/lib/currency.ts`
- Test: `src/lib/currency.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CurrencyMeta.country: string` (lowercase ISO 3166-1 alpha-2),
  populated on every entry in `CURRENCIES`. Task 4's `CurrencySelect` reads
  `meta.country` to build the `fi fi-<country>` flag class.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/currency.test.ts`, inside the existing
`describe("currency metadata", ...)` block (after the "has unique 3-letter
uppercase codes" test):

```ts
  it("has a lowercase two-letter country code for every currency (used for flag icons)", () => {
    for (const c of CURRENCIES) {
      expect(c.country).toMatch(/^[a-z]{2}$/);
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/currency.test.ts`
Expected: FAIL — `c.country` is `undefined`, doesn't match `/^[a-z]{2}$/`.

- [ ] **Step 3: Add the `country` field**

Replace the full contents of `src/lib/currency.ts`:

```ts
/**
 * Single source of truth for the curated currency list (CLAUDE.md rule 1).
 * Each event picks one of these at creation; MYR is the default. Only JPY
 * has a zero-decimal minor unit -- everything else here uses 2. `country`
 * is a lowercase ISO 3166-1 alpha-2 code used to render an SVG flag via the
 * `flag-icons` package's `fi fi-<country>` class (EUR uses `eu`, the flag
 * `flag-icons` ships for the European Union, since it isn't one country).
 */
export interface CurrencyMeta {
  code: string;
  label: string;
  symbol: string;
  minorUnit: 0 | 2;
  country: string;
}

export const CURRENCIES: readonly CurrencyMeta[] = [
  { code: "MYR", label: "Malaysian Ringgit", symbol: "RM", minorUnit: 2, country: "my" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", minorUnit: 2, country: "sg" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥", minorUnit: 0, country: "jp" },
  { code: "CNY", label: "Chinese Yuan (RMB)", symbol: "CN¥", minorUnit: 2, country: "cn" },
  { code: "TWD", label: "New Taiwan Dollar", symbol: "NT$", minorUnit: 2, country: "tw" },
  { code: "USD", label: "US Dollar", symbol: "US$", minorUnit: 2, country: "us" },
  { code: "THB", label: "Thai Baht", symbol: "฿", minorUnit: 2, country: "th" },
  { code: "IDR", label: "Indonesian Rupiah", symbol: "Rp", minorUnit: 2, country: "id" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$", minorUnit: 2, country: "hk" },
  { code: "EUR", label: "Euro", symbol: "€", minorUnit: 2, country: "eu" },
  { code: "GBP", label: "British Pound", symbol: "£", minorUnit: 2, country: "gb" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", minorUnit: 2, country: "au" },
] as const;

export const DEFAULT_CURRENCY = "MYR" as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [string, ...string[]];

const metaByCode = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrencyMeta(code: string): CurrencyMeta {
  const meta = metaByCode.get(code);
  if (!meta) throw new Error(`Unsupported currency code: ${code}`);
  return meta;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/currency.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/currency.ts src/lib/currency.test.ts
git commit -m "feat: add ISO country codes to curated currencies for flag icons"
```

---

### Task 3: Reject start-date-after-end-date server-side

**Files:**
- Modify: `src/lib/validation/event.ts`
- Test: `src/lib/validation/event.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `createEventSchema` and `updateEventSchema` both reject a
  payload where both dates are present and `startDate > endDate` (string
  comparison — both are `YYYY-MM-DD`, which sorts lexicographically the same
  as chronologically). This is defense-in-depth; no UI in this plan can
  reach the invalid state after Task 5.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/validation/event.test.ts`, inside
`describe("createEventSchema", ...)` (after "rejects a blank name"):

```ts
  it("rejects a start date after the end date", () => {
    const result = createEventSchema.safeParse({
      name: "Tokyo Trip",
      startDate: "2026-08-10",
      endDate: "2026-08-05",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a start date on or before the end date", () => {
    expect(
      createEventSchema.safeParse({
        name: "Tokyo Trip",
        startDate: "2026-08-05",
        endDate: "2026-08-05",
      }).success,
    ).toBe(true);
    expect(
      createEventSchema.safeParse({
        name: "Tokyo Trip",
        startDate: "2026-08-05",
        endDate: "2026-08-10",
      }).success,
    ).toBe(true);
  });

  it("accepts when only one date is set", () => {
    expect(
      createEventSchema.safeParse({ name: "Tokyo Trip", startDate: "2026-08-05" }).success,
    ).toBe(true);
    expect(
      createEventSchema.safeParse({ name: "Tokyo Trip", endDate: "2026-08-05" }).success,
    ).toBe(true);
  });
```

Add to `describe("updateEventSchema", ...)` (after "still requires at least
one field"):

```ts
  it("rejects a start date after the end date", () => {
    const result = updateEventSchema.safeParse({
      startDate: "2026-08-10",
      endDate: "2026-08-05",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a start date on or before the end date", () => {
    expect(
      updateEventSchema.safeParse({ startDate: "2026-08-05", endDate: "2026-08-10" }).success,
    ).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/validation/event.test.ts`
Expected: FAIL on the four new "rejects/accepts a start date..." cases —
both schemas currently accept any combination of valid ISO dates regardless
of order.

- [ ] **Step 3: Add the cross-field refine to both schemas**

Replace the full contents of `src/lib/validation/event.ts`:

```ts
import { z } from "zod";
import { CURRENCY_CODES, DEFAULT_CURRENCY } from "@/lib/currency";

function datesInOrder(data: { startDate?: string | null; endDate?: string | null }): boolean {
  if (!data.startDate || !data.endDate) return true;
  return data.startDate <= data.endDate;
}

export const createEventSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required"),
    currency: z.enum(CURRENCY_CODES).default(DEFAULT_CURRENCY),
    startDate: z.iso.date().optional(),
    endDate: z.iso.date().optional(),
    // Optional per system-design.md §5; the current UI (Screen Spec P3-04)
    // never sends this and expects every active group member included by
    // default -- see route.ts for that fallback.
    memberIds: z.array(z.string().uuid()).optional(),
  })
  .refine(datesInOrder, {
    message: "Start date must be on or before the end date",
    path: ["endDate"],
  });

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const eventStatusSchema = z.enum(["active", "archived"]);

export const updateEventSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required").optional(),
    // null clears a previously-set date; undefined leaves it untouched.
    startDate: z.iso.date().nullable().optional(),
    endDate: z.iso.date().nullable().optional(),
    status: eventStatusSchema.optional(),
  })
  .refine(
    (data) =>
      data.name !== undefined ||
      data.startDate !== undefined ||
      data.endDate !== undefined ||
      data.status !== undefined,
    { message: "At least one field must be provided" },
  )
  .refine(datesInOrder, {
    message: "Start date must be on or before the end date",
    path: ["endDate"],
  });

export type UpdateEventInput = z.infer<typeof updateEventSchema>;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/validation/event.test.ts`
Expected: PASS, all tests in the file green.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: PASS — no other test imports `createEventSchema`/
`updateEventSchema` with a date pair, so nothing else should be affected.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation/event.ts src/lib/validation/event.test.ts
git commit -m "fix: reject start date after end date server-side"
```

---

### Task 4: Build CurrencySelect and wire it into CreateEventModal

**Files:**
- Create: `src/components/ui/CurrencySelect.tsx`
- Modify: `src/components/events/CreateEventModal.tsx`

**Interfaces:**
- Consumes: `CURRENCIES`, `getCurrencyMeta` from `src/lib/currency.ts`
  (Task 2 — each entry now has `country`).
- Produces: `CurrencySelect({ value: string, onChange: (code: string) =>
  void })` — a drop-in replacement for the native `<select>`, same
  controlled shape.

- [ ] **Step 1: Create `src/components/ui/CurrencySelect.tsx`**

```tsx
"use client";

import { ChevronDown } from "lucide-react";
import { Button, ListBox, ListBoxItem, Popover, Select } from "react-aria-components";
import { CURRENCIES, getCurrencyMeta } from "@/lib/currency";

interface CurrencySelectProps {
  value: string;
  onChange: (code: string) => void;
}

export function CurrencySelect({ value, onChange }: CurrencySelectProps) {
  const selected = getCurrencyMeta(value);

  return (
    <Select
      selectedKey={value}
      onSelectionChange={(key) => onChange(key as string)}
      aria-label="Currency"
    >
      <Button className="flex w-full items-center gap-2 rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text">
        <span className={`fi fi-${selected.country} rounded-[3px]`} aria-hidden="true" />
        <span className="font-bold">{selected.code}</span>
        <span className="truncate text-muted-2">{selected.label}</span>
        <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
      </Button>
      <Popover className="w-[--trigger-width] rounded-md border border-ink/14 bg-white shadow-[0_16px_36px_-20px_rgba(19,46,40,0.22)] dark:border-white/14 dark:bg-dark-card">
        <ListBox className="max-h-72 overflow-auto py-1 outline-none">
          {CURRENCIES.map((c) => (
            <ListBoxItem
              key={c.code}
              id={c.code}
              textValue={`${c.code} ${c.label}`}
              className="flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-sm text-ink outline-none data-[focused]:bg-mint-tint data-[focused]:text-forest dark:text-dark-text dark:data-[focused]:bg-mint/16 dark:data-[focused]:text-mint"
            >
              <span className={`fi fi-${c.country} rounded-[3px]`} aria-hidden="true" />
              <span className="font-bold">{c.code}</span>
              <span className="text-muted-2">{c.label}</span>
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
```

- [ ] **Step 2: Wire it into `CreateEventModal`**

In `src/components/events/CreateEventModal.tsx`, change the import line:

```tsx
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currency";
```
to:
```tsx
import { CurrencySelect } from "@/components/ui/CurrencySelect";
import { DEFAULT_CURRENCY } from "@/lib/currency";
```

Replace the currency field block:
```tsx
        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Currency</label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-sm text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.label}
              </option>
            ))}
          </select>
        </div>
```
with:
```tsx
        <div className="mb-3.5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Currency</label>
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>
```

- [ ] **Step 3: Verify the build and types**

Run: `npm run build`
Expected: build completes with no TypeScript or lint errors.

- [ ] **Step 4: Manually verify in the dev server**

Run: `npm run dev`, open the app, create or open a group, click "+ New
event" to open `CreateEventModal` (Screen Spec P3-04). Confirm:
- The currency field shows a flag, code, and label, with a chevron on the
  trailing edge (not the old native-select arrow).
- Clicking it opens a popover listing all 12 currencies, each with its own
  flag.
- Selecting one updates the trigger and closes the popover.
- Keyboard: Tab to the field, Enter/Space opens it, arrow keys move through
  options, Enter selects — matches native `<select>` keyboard behavior.
- Dark mode (toggle via `ThemeToggle`) renders correctly — no unstyled
  white flashes or unreadable text.

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/CurrencySelect.tsx src/components/events/CreateEventModal.tsx
git commit -m "feat: replace native currency select with flagged CurrencySelect"
```

---

### Task 5: Build EventDateRangeField and wire it into CreateEventModal

**Files:**
- Create: `src/components/ui/EventDateRangeField.tsx`
- Modify: `src/components/events/CreateEventModal.tsx`

**Interfaces:**
- Consumes: `parseDate` from `@internationalized/date`.
- Produces: `EventDateRangeField({ value: { start: string; end: string } |
  null, onChange: (value: { start: string; end: string } | null) => void
  })` — ISO `YYYY-MM-DD` strings in and out; internally converts to/from
  `@internationalized/date`'s `CalendarDate` at the component boundary so no
  other file needs to know that type exists.

- [ ] **Step 1: Create `src/components/ui/EventDateRangeField.tsx`**

```tsx
"use client";

import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { parseDate } from "@internationalized/date";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  DateInput,
  DateRangePicker,
  DateSegment,
  Dialog,
  Group,
  Heading,
  Popover,
  RangeCalendar,
} from "react-aria-components";

interface EventDateRangeFieldProps {
  value: { start: string; end: string } | null;
  onChange: (value: { start: string; end: string } | null) => void;
}

export function EventDateRangeField({ value, onChange }: EventDateRangeFieldProps) {
  const rangeValue = value
    ? { start: parseDate(value.start), end: parseDate(value.end) }
    : null;

  return (
    <DateRangePicker
      value={rangeValue}
      onChange={(range) => {
        if (!range) {
          onChange(null);
          return;
        }
        onChange({ start: range.start.toString(), end: range.end.toString() });
      }}
      aria-label="Event dates"
    >
      <Group className="flex w-full items-center gap-1.5 rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-[13px] text-ink outline-none focus-within:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text">
        <DateInput slot="start" className="flex">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="px-0.5 tabular-nums outline-none data-[placeholder]:text-muted-2"
            />
          )}
        </DateInput>
        <span aria-hidden="true" className="text-muted-2">
          –
        </span>
        <DateInput slot="end" className="flex">
          {(segment) => (
            <DateSegment
              segment={segment}
              className="px-0.5 tabular-nums outline-none data-[placeholder]:text-muted-2"
            />
          )}
        </DateInput>
        <Button className="ml-auto text-muted-2" aria-label="Open calendar">
          <CalendarRange className="h-4 w-4" aria-hidden="true" />
        </Button>
      </Group>
      <Popover className="rounded-md border border-ink/14 bg-white p-4 shadow-[0_16px_36px_-20px_rgba(19,46,40,0.22)] dark:border-white/14 dark:bg-dark-card">
        <Dialog className="outline-none">
          <RangeCalendar>
            <header className="mb-2 flex items-center justify-between">
              <Button slot="previous" className="text-ink dark:text-dark-text">
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Heading className="text-sm font-bold text-ink dark:text-dark-text" />
              <Button slot="next" className="text-ink dark:text-dark-text">
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
            </header>
            <CalendarGrid className="border-collapse">
              {(date) => (
                <CalendarCell
                  date={date}
                  className="cursor-pointer rounded-md p-2 text-center text-[13px] text-ink outline-none data-[selected]:bg-forest data-[selected]:text-cream data-[outside-month]:text-muted-2/40 data-[unavailable]:cursor-not-allowed data-[unavailable]:opacity-30 dark:text-dark-text dark:data-[selected]:bg-dark-forest"
                />
              )}
            </CalendarGrid>
          </RangeCalendar>
        </Dialog>
      </Popover>
    </DateRangePicker>
  );
}
```

- [ ] **Step 2: Wire it into `CreateEventModal`**

In `src/components/events/CreateEventModal.tsx`, add an import:

```tsx
import { EventDateRangeField } from "@/components/ui/EventDateRangeField";
```

Replace the two date-state declarations:
```tsx
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
```
with:
```tsx
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(null);
```

Replace the submit body's date fields:
```tsx
          startDate: startDate || undefined,
          endDate: endDate || undefined,
```
with:
```tsx
          startDate: dateRange?.start,
          endDate: dateRange?.end,
```

Replace the two-column date-input block:
```tsx
        <div className="mb-5 flex gap-2.5">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold text-muted-2">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-ink/14 bg-cream px-3 py-3 text-[13px] text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-bold text-muted-2">End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-ink/14 bg-cream px-3 py-3 text-[13px] text-ink outline-none focus:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text [color-scheme:light] dark:[color-scheme:dark]"
            />
          </div>
        </div>
```
with:
```tsx
        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-bold text-muted-2">Dates</label>
          <EventDateRangeField value={dateRange} onChange={setDateRange} />
          <p className="mt-1.5 text-[11px] text-muted-2">Optional — for your own reference.</p>
        </div>
```

- [ ] **Step 3: Verify the build and types**

Run: `npm run build`
Expected: build completes with no TypeScript or lint errors.

- [ ] **Step 4: Manually verify in the dev server**

Run: `npm run dev`, open `CreateEventModal` again. Confirm:
- The dates field shows empty keyboard-editable segments (`mm/dd/yyyy –
  mm/dd/yyyy` placeholder style) plus a calendar-range icon button.
- Clicking the icon opens a single calendar popover.
- Clicking a start date then an end date selects the range; the trigger
  updates to show both.
- **The bug fix**: try to select an end date before the chosen start date —
  confirm this is not possible (either the calendar restarts the range from
  the new click, or earlier dates become unselectable — either way you
  cannot end up with start > end).
- Clear both segments (or don't touch the field) and submit the form —
  confirm the event is created with no dates, proving the field stays
  optional.
- Dark mode renders correctly.

Stop the dev server once confirmed.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/EventDateRangeField.tsx src/components/events/CreateEventModal.tsx
git commit -m "fix: replace independent date inputs with a range picker that prevents end-before-start"
```

---

### Task 6: Replace emoji icons in EventDashboard and BillForm

**Files:**
- Modify: `src/components/events/EventDashboard.tsx`
- Modify: `src/components/bills/BillForm.tsx`

**Interfaces:**
- Consumes: `lucide-react` icons (Task 1).
- Produces: no prop/behavior changes — purely visual icon swaps.

- [ ] **Step 1: Update `EventDashboard.tsx` imports**

Add, after the existing `import { useCountUp } from "@/lib/useCountUp";`
line:

```tsx
import { Link as LinkIcon, Lock, Pencil, Receipt, Trash2 } from "lucide-react";
```

(Aliased to `LinkIcon` because this file already imports Next's `Link` for
routing — both are needed.)

- [ ] **Step 2: Replace the Share button's 🔗**

Replace:
```tsx
            <button
              type="button"
              onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 rounded-md border border-ink/14 bg-white px-4 py-2 text-[12.5px] font-bold text-ink dark:border-white/14 dark:bg-dark-card dark:text-dark-text"
            >
              🔗 Share
            </button>
```
with:
```tsx
            <button
              type="button"
              onClick={() => setShowShare(true)}
              className="flex items-center gap-1.5 rounded-md border border-ink/14 bg-white px-4 py-2 text-[12.5px] font-bold text-ink dark:border-white/14 dark:bg-dark-card dark:text-dark-text"
            >
              <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" /> Share
            </button>
```

- [ ] **Step 3: Replace the empty-bills 🧾**

Replace:
```tsx
      <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-mint-tint text-2xl dark:bg-mint/16">
        🧾
      </div>
```
with:
```tsx
      <div className="mb-4 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-mint-tint text-emerald dark:bg-mint/16 dark:text-mint">
        <Receipt className="h-6 w-6" aria-hidden="true" />
      </div>
```

- [ ] **Step 4: Replace the bill-row lock/pencil/trash**

Replace:
```tsx
        {canEdit && (
          <div className="flex items-center gap-2.5 text-sm text-muted-2">
            <Link
              href={`/g/${groupId}/events/${eventId}/bills/${bill.id}/edit`}
              title={settled ? "Settled — view only" : "Edit bill"}
            >
              {settled ? "🔒" : "✎"}
            </Link>
            {!settled && (
              <button type="button" onClick={onRequestDelete} aria-label="Delete bill">
                🗑
              </button>
            )}
          </div>
        )}
```
with:
```tsx
        {canEdit && (
          <div className="flex items-center gap-2.5 text-sm text-muted-2">
            <Link
              href={`/g/${groupId}/events/${eventId}/bills/${bill.id}/edit`}
              title={settled ? "Settled — view only" : "Edit bill"}
            >
              {settled ? (
                <Lock className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pencil className="h-4 w-4" aria-hidden="true" />
              )}
            </Link>
            {!settled && (
              <button type="button" onClick={onRequestDelete} aria-label="Delete bill">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
```

- [ ] **Step 5: Update `BillForm.tsx` imports**

Add, after the existing `import { computeEqualSplit } from
"@/lib/settlement";` line:

```tsx
import { Check, Lock, TriangleAlert } from "lucide-react";
```

- [ ] **Step 6: Replace the equal-split ✓ confirmation**

Replace:
```tsx
            <div
              className={cn(
                "flex items-center gap-2 text-[13px] font-bold",
                equalShares ? "text-emerald dark:text-mint" : "text-muted-2",
              )}
            >
              {equalShares ? `✓ Adds up to ${formatMoney(totalAmountSen, currency)}` : "Enter an amount above"}
            </div>
```
with:
```tsx
            <div
              className={cn(
                "flex items-center gap-1.5 text-[13px] font-bold",
                equalShares ? "text-emerald dark:text-mint" : "text-muted-2",
              )}
            >
              {equalShares ? (
                <>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {`Adds up to ${formatMoney(totalAmountSen, currency)}`}
                </>
              ) : (
                "Enter an amount above"
              )}
            </div>
```

- [ ] **Step 7: Replace the custom-split ⚠ warning**

Replace:
```tsx
            {!customReconciled && (
              <div className="flex items-center gap-2 rounded-md border border-coral-tint-border bg-coral-tint px-4 py-3 text-[13px] font-bold text-coral dark:border-coral/30 dark:bg-coral/10">
                ⚠ Amounts don&apos;t add up —{" "}
                {formatMoney(Math.abs(totalAmountSen - customRunningTotal), currency)}
                {customRunningTotal < totalAmountSen ? " short of " : " over "}
                {formatMoney(totalAmountSen, currency)}
              </div>
            )}
```
with:
```tsx
            {!customReconciled && (
              <div className="flex items-center gap-2 rounded-md border border-coral-tint-border bg-coral-tint px-4 py-3 text-[13px] font-bold text-coral dark:border-coral/30 dark:bg-coral/10">
                <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Amounts don&apos;t add up —{" "}
                  {formatMoney(Math.abs(totalAmountSen - customRunningTotal), currency)}
                  {customRunningTotal < totalAmountSen ? " short of " : " over "}
                  {formatMoney(totalAmountSen, currency)}
                </span>
              </div>
            )}
```

- [ ] **Step 8: Replace the locked-bill-view 🔒 (×2)**

Replace:
```tsx
        <div className="mb-4 flex items-center gap-2.5">
          <span className="text-xl">🔒</span>
          <h1 className="num text-[22px] text-ink dark:text-dark-text">{bill.title}</h1>
        </div>
        <div className="mb-4.5 flex items-center gap-2.5 rounded-md bg-cream px-4.5 py-4 dark:bg-dark-bg">
          <span className="text-[15px]">🔒</span>
          <p className="text-[13px] leading-relaxed text-muted dark:text-dark-muted">
```
with:
```tsx
        <div className="mb-4 flex items-center gap-2.5">
          <Lock className="h-5 w-5 text-ink dark:text-dark-text" aria-hidden="true" />
          <h1 className="num text-[22px] text-ink dark:text-dark-text">{bill.title}</h1>
        </div>
        <div className="mb-4.5 flex items-center gap-2.5 rounded-md bg-cream px-4.5 py-4 dark:bg-dark-bg">
          <Lock className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-[13px] leading-relaxed text-muted dark:text-dark-muted">
```

- [ ] **Step 9: Verify the build and check for leftover emoji**

Run: `npm run build`
Expected: build completes with no TypeScript or lint errors.

Run:
```bash
grep -noE "🔗|🧾|🔒|✎|🗑|⚠|✓" src/components/events/EventDashboard.tsx src/components/bills/BillForm.tsx
```
Expected: no output (empty — every occurrence in these two files replaced).

- [ ] **Step 10: Manually verify in the dev server**

Run: `npm run dev`. Open an event dashboard: confirm the Share button,
empty-bills receipt icon (if the event has no bills), and each bill row's
lock/pencil/trash icons render correctly in both light and dark mode. Open
"Add a bill", enter an amount, and confirm the ✓/⚠ icons render correctly
for both the equal-split confirmation and the custom-split mismatch
warning. Open a settled bill and confirm both lock icons render in the
locked view. Stop the dev server once confirmed.

- [ ] **Step 11: Commit**

```bash
git add src/components/events/EventDashboard.tsx src/components/bills/BillForm.tsx
git commit -m "refactor: replace emoji icons with lucide-react in event dashboard and bill form"
```

---

### Task 7: Replace emoji icons in ShareDialog, MemberChip, SettleUpFlow, and Landing

**Files:**
- Modify: `src/components/group/ShareDialog.tsx`
- Modify: `src/components/members/MemberChip.tsx`
- Modify: `src/components/settle/SettleUpFlow.tsx`
- Modify: `src/components/landing/Landing.tsx`

**Interfaces:**
- Consumes: `lucide-react` icons (Task 1).
- Produces: no prop/behavior changes — purely visual icon swaps.

- [ ] **Step 1: Update `ShareDialog.tsx` imports**

Add, after the existing `import type { shareLinkRoleSchema } from
"@/lib/validation/group";` line:

```tsx
import { Check, Link } from "lucide-react";
```

(No alias needed — this file doesn't import Next's `Link`.)

- [ ] **Step 2: Replace the "Copied to clipboard" ✓**

Replace:
```tsx
                    <p
                      className={cn(
                        "mb-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald transition-opacity dark:text-mint",
                        copied ? "opacity-100" : "pointer-events-none h-0 opacity-0",
                      )}
                      aria-hidden={!copied}
                    >
                      ✓ Copied to clipboard
                    </p>
```
with:
```tsx
                    <p
                      className={cn(
                        "mb-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald transition-opacity dark:text-mint",
                        copied ? "opacity-100" : "pointer-events-none h-0 opacity-0",
                      )}
                      aria-hidden={!copied}
                    >
                      <Check className="h-3 w-3" aria-hidden="true" /> Copied to clipboard
                    </p>
```

- [ ] **Step 3: Replace the "heads up" banner's 🔗**

Replace:
```tsx
            <div className="mb-6 flex gap-2.5 rounded-md bg-sky-tint px-4 py-3.5 dark:bg-sky/12">
              <span className="text-sm">🔗</span>
              <p className="text-[11.5px] leading-relaxed text-sky-text dark:text-dark-text/80">
```
with:
```tsx
            <div className="mb-6 flex gap-2.5 rounded-md bg-sky-tint px-4 py-3.5 dark:bg-sky/12">
              <Link className="h-4 w-4 shrink-0 text-sky-text dark:text-dark-text/80" aria-hidden="true" />
              <p className="text-[11.5px] leading-relaxed text-sky-text dark:text-dark-text/80">
```

- [ ] **Step 4: Update `MemberChip.tsx` imports and replace the rename ✎**

Add, after the existing `import { useCountUp } from "@/lib/useCountUp";`
line:

```tsx
import { Pencil } from "lucide-react";
```

Replace:
```tsx
              {canEdit && <span className="text-[11px] text-muted-2">✎</span>}
```
with:
```tsx
              {canEdit && <Pencil className="h-3 w-3 text-muted-2" aria-hidden="true" />}
```

- [ ] **Step 5: Update `SettleUpFlow.tsx` imports**

Add, after the existing `import { TransferGraph } from "./TransferGraph";`
line:

```tsx
import { Check } from "lucide-react";
```

- [ ] **Step 6: Replace the bill-checkbox ✓**

Replace:
```tsx
                      <span
                        className={
                          checked
                            ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-forest text-[13px] text-cream dark:bg-dark-forest"
                            : "h-5 w-5 shrink-0 rounded-md border-2 border-ink/16 dark:border-white/20"
                        }
                      >
                        {checked && "✓"}
                      </span>
```
with:
```tsx
                      <span
                        className={
                          checked
                            ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-forest text-cream dark:bg-dark-forest"
                            : "h-5 w-5 shrink-0 rounded-md border-2 border-ink/16 dark:border-white/20"
                        }
                      >
                        {checked && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      </span>
```

- [ ] **Step 7: Replace the transfer-summary banner's ✓**

Replace:
```tsx
        <div className="mt-6 mb-4.5 flex items-center gap-2 rounded-md bg-mint-tint px-5 py-3.5 text-sm font-bold text-emerald dark:bg-mint/16 dark:text-mint">
          ✓ {transfers.length} transfer{transfers.length === 1 ? "" : "s"} settle everyone
        </div>
```
with:
```tsx
        <div className="mt-6 mb-4.5 flex items-center gap-2 rounded-md bg-mint-tint px-5 py-3.5 text-sm font-bold text-emerald dark:bg-mint/16 dark:text-mint">
          <Check className="h-4 w-4" aria-hidden="true" />
          {transfers.length} transfer{transfers.length === 1 ? "" : "s"} settle everyone
        </div>
```

- [ ] **Step 8: Update `Landing.tsx` imports and replace the hero ✓**

Add, after the existing `import { PasteLinkPanel } from "./PasteLinkPanel";`
line:

```tsx
import { Check } from "lucide-react";
```

Replace:
```tsx
              <div className="mt-1.5 flex items-center gap-1.5 rounded-[11px] bg-mint-tint px-3.5 py-2.5 dark:bg-mint/16">
                <span className="text-[13px] text-emerald dark:text-mint">✓</span>
                <span className="text-[12.5px] font-bold text-emerald dark:text-mint">
                  3 transfers settle everyone
                </span>
              </div>
```
with:
```tsx
              <div className="mt-1.5 flex items-center gap-1.5 rounded-[11px] bg-mint-tint px-3.5 py-2.5 dark:bg-mint/16">
                <Check className="h-3.5 w-3.5 text-emerald dark:text-mint" aria-hidden="true" />
                <span className="text-[12.5px] font-bold text-emerald dark:text-mint">
                  3 transfers settle everyone
                </span>
              </div>
```

- [ ] **Step 9: Verify the build and check for leftover pictographic emoji app-wide**

Run: `npm run build`
Expected: build completes with no TypeScript or lint errors.

Run:
```bash
grep -noE "🔗|🧾|🔒|✎|🗑|⚠|✓" -r src
```
Expected: no output (empty — every pictographic emoji used as a UI icon has
been replaced across the whole app). Non-pictographic glyphs like `+`, `×`,
`←`, `↗` are expected to remain untouched — this grep pattern doesn't match
them.

- [ ] **Step 10: Run the full test suite**

Run: `npm test`
Expected: PASS — this task changes no logic, only JSX markup, so no
existing test should be affected.

- [ ] **Step 11: Manually verify in the dev server**

Run: `npm run dev`. Check: the landing page's hero "3 transfers settle
everyone" pill, the group ShareDialog's copy-confirmation and heads-up
banner, a member chip's rename pencil (hover/click to rename), and the
settle-up flow's bill checkboxes and final "N transfers settle everyone"
banner. Confirm all render correctly in light and dark mode. Stop the dev
server once confirmed.

- [ ] **Step 12: Commit**

```bash
git add src/components/group/ShareDialog.tsx src/components/members/MemberChip.tsx src/components/settle/SettleUpFlow.tsx src/components/landing/Landing.tsx
git commit -m "refactor: replace emoji icons with lucide-react across the remaining UI"
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers dependencies; Task 2 covers the
  `country` field; Task 3 covers server-side defense-in-depth; Task 4
  covers the currency picker; Task 5 covers the date-range picker and its
  "unreachable invalid state" requirement and the "optional" hint; Tasks 6–7
  cover all 13 emoji occurrences across all 6 files identified in the spec.
  No spec section is without a task.
- **Type consistency:** `CurrencySelect`'s `value`/`onChange` and
  `EventDateRangeField`'s `value`/`onChange` shapes are used identically in
  Task 4 Step 2 and Task 5 Step 2 as they're declared in Task 4 Step 1 and
  Task 5 Step 1.
- **Import collisions checked:** `EventDashboard.tsx` and `BillForm.tsx`
  both already import Next's `Link`; only `EventDashboard.tsx` also needs
  the icon named `Link`, so only that file aliases it as `LinkIcon`.
  `ShareDialog.tsx` has no existing `Link` import, so no alias needed there.
