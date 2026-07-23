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
