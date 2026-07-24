/**
 * Single source of truth for the curated currency list (CLAUDE.md rule 1).
 * Each event picks one of these at creation; MYR is the default. Only JPY
 * has a zero-decimal minor unit -- everything else here uses 2.
 */
export interface CurrencyMeta {
  code: string;
  label: string;
  symbol: string;
  minorUnit: 0 | 2;
}

export const CURRENCIES: readonly CurrencyMeta[] = [
  { code: "MYR", label: "Malaysian Ringgit", symbol: "RM", minorUnit: 2 },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", minorUnit: 2 },
  { code: "JPY", label: "Japanese Yen", symbol: "¥", minorUnit: 0 },
  { code: "CNY", label: "Chinese Yuan (RMB)", symbol: "CN¥", minorUnit: 2 },
  { code: "TWD", label: "New Taiwan Dollar", symbol: "NT$", minorUnit: 2 },
  { code: "USD", label: "US Dollar", symbol: "US$", minorUnit: 2 },
  { code: "THB", label: "Thai Baht", symbol: "฿", minorUnit: 2 },
  { code: "IDR", label: "Indonesian Rupiah", symbol: "Rp", minorUnit: 2 },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$", minorUnit: 2 },
  { code: "EUR", label: "Euro", symbol: "€", minorUnit: 2 },
  { code: "GBP", label: "British Pound", symbol: "£", minorUnit: 2 },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", minorUnit: 2 },
] as const;

export const DEFAULT_CURRENCY = "MYR" as const;

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code) as [string, ...string[]];

const metaByCode = new Map(CURRENCIES.map((c) => [c.code, c]));

export function getCurrencyMeta(code: string): CurrencyMeta {
  const meta = metaByCode.get(code);
  if (!meta) throw new Error(`Unsupported currency code: ${code}`);
  return meta;
}
