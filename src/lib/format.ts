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

/** e.g. "Mar 12 – Mar 20" or just "Mar 12" when only one date is set. */
export function formatDateRange(
  startDate: string | null,
  endDate: string | null,
): string | null {
  if (!startDate && !endDate) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-MY", { month: "short", day: "numeric" });
  if (startDate && endDate) return `${fmt(startDate)} – ${fmt(endDate)}`;
  return fmt(startDate ?? endDate!);
}
