import { DEFAULT_CURRENCY, getCurrencyMeta } from "@/lib/currency";

/**
 * Converts an integer amount (in the smallest unit of `currencyCode`) to a
 * display string, e.g. 124000 -> "RM 1,240.00" for MYR, or 1500 -> "¥1,500"
 * for JPY (CLAUDE.md rule 1). Money is only ever converted to a decimal at
 * this UI boundary -- never store or compute with the result.
 */
export function formatMoney(amount: number, currencyCode: string = DEFAULT_CURRENCY): string {
  const { symbol, minorUnit } = getCurrencyMeta(currencyCode);
  const display = (amount / 10 ** minorUnit).toLocaleString("en-MY", {
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
  });
  return `${symbol}${minorUnit === 0 ? "" : " "}${display}`;
}

/** e.g. "12 Mar – 20 Mar" or just "12 Mar" when only one date is set.
 *
 * Event dates are date-only values stored at UTC midnight, so they are parsed
 * from their y-m-d parts rather than handed to `new Date(iso)` -- that would
 * anchor them to UTC and render the previous day for any viewer west of UTC.
 * Accepts either "2026-03-12" or a full ISO timestamp; only the date half is
 * ever read. */
export function formatDateRange(
  startDate: string | null,
  endDate: string | null,
): string | null {
  if (!startDate && !endDate) return null;
  const fmt = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
    });
  };
  if (startDate && endDate) return `${fmt(startDate)} – ${fmt(endDate)}`;
  return fmt(startDate ?? endDate!);
}

/** e.g. "6 Aug" -- used for the "archived 6 Aug" meta segment on the
 * archived-events/groups screens. Callers omit the whole segment when the
 * underlying date is null (T0: rows archived before the column existed). */
export function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
}
