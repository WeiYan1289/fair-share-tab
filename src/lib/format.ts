/**
 * Converts an integer sen amount to a display string, e.g. 124000 -> "RM
 * 1,240.00" (CLAUDE.md rule 1). Money is only ever converted to a decimal
 * at this UI boundary -- never store or compute with the result.
 */
export function formatMoney(sen: number, currency = "RM"): string {
  const amount = (sen / 100).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${amount}`;
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
