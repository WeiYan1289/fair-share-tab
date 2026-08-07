/**
 * Single source of truth for the curated currency list (CLAUDE.md rule 1).
 * Each event picks one of these at creation; MYR is the default. JPY and
 * KRW have a zero-decimal minor unit -- everything else here uses 2, so
 * never assume a division by 100 anywhere. `country`
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
  { code: "KRW", label: "South Korean Won", symbol: "₩", minorUnit: 0, country: "kr" },
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
