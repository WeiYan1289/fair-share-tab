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
