"use client";

import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { parseDate, type CalendarDate } from "@internationalized/date";
import {
  Button,
  CalendarCell,
  CalendarGrid,
  DateRangePicker,
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

/** Formats from the CalendarDate's own parts rather than `new Date(iso)`, which
 * would parse "2026-08-08" as UTC midnight and render the previous day for
 * anyone west of UTC. */
function formatDay(date: CalendarDate, withYear: boolean): string {
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    ...(withYear && { year: "numeric" }),
  });
}

/** "20 Aug – 28 Aug 2026" within one year, "28 Dec 2026 – 3 Jan 2027" across
 * two. The year is always present -- a trip's year matters when you're
 * scrolling back through old events -- but repeating it on both ends of a
 * same-year range only costs width. */
function formatRange(start: CalendarDate, end: CalendarDate): string {
  const sameYear = start.year === end.year;
  return `${formatDay(start, !sameYear)} – ${formatDay(end, true)}`;
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
        // RangeCalendar is now the only input path and always hands back
        // start <= end, but the swap stays as a cheap guard so the invariant
        // holds at this boundary rather than depending on the picker.
        const [start, end] =
          range.start.compare(range.end) > 0
            ? [range.end, range.start]
            : [range.start, range.end];
        onChange({ start: start.toString(), end: end.toString() });
      }}
      aria-label="Event dates"
    >
      {/* Group stays even though it wraps a single child: RAC anchors the
        * Popover to the Group's ref (`triggerRef: groupRef`), so without it the
        * calendar renders at the viewport origin instead of beside the field.
        *
        * The Button inside fills the whole Group, making the entire field the
        * trigger. Typed DateInput segments were dropped deliberately: on mobile
        * only the calendar icon opened the picker, and tapping the segments
        * raised a numeric keyboard that silently edited one segment at a time.
        * Picking from the calendar is the single supported way to set a range. */}
      <Group className="w-full">
        <Button
          className="flex w-full items-center gap-1.5 rounded-md border border-ink/14 bg-cream px-3.5 py-3 text-left text-[13px] text-ink outline-none data-[focus-visible]:border-forest dark:border-white/14 dark:bg-dark-bg dark:text-dark-text"
          aria-label="Event dates — open calendar"
        >
          {rangeValue ? (
            <span className="tabular-nums">
              {formatRange(rangeValue.start, rangeValue.end)}
            </span>
          ) : (
            <span className="text-muted-2">Select dates</span>
          )}
          <CalendarRange className="ml-auto h-4 w-4 shrink-0 text-muted-2" aria-hidden="true" />
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
          {/* Dates are optional, so there has to be a way back to blank now that
            * the segments (which could be cleared by keyboard) are gone. */}
          {rangeValue && (
            <div className="mt-3 border-t border-ink/8 pt-3 dark:border-white/8">
              <Button
                onPress={() => onChange(null)}
                className="text-[12px] font-bold text-link dark:text-mint"
              >
                Clear dates
              </Button>
            </div>
          )}
        </Dialog>
      </Popover>
    </DateRangePicker>
  );
}
