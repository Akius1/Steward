// ─── Currency System ──────────────────────────────────────────────────────────

export const CURRENCIES = {
  NGN: { code: 'NGN', symbol: '₦',   name: 'Nigerian Naira',      unit: 'naira',    flag: '🇳🇬', locale: 'en-NG' },
  USD: { code: 'USD', symbol: '$',   name: 'US Dollar',            unit: 'dollar',   flag: '🇺🇸', locale: 'en-US' },
  GBP: { code: 'GBP', symbol: '£',   name: 'British Pound',       unit: 'pound',    flag: '🇬🇧', locale: 'en-GB' },
  EUR: { code: 'EUR', symbol: '€',   name: 'Euro',                 unit: 'euro',     flag: '🇪🇺', locale: 'de-DE' },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling',     unit: 'shilling', flag: '🇰🇪', locale: 'en-KE' },
  ZAR: { code: 'ZAR', symbol: 'R',   name: 'South African Rand',  unit: 'rand',     flag: '🇿🇦', locale: 'en-ZA' },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi',      unit: 'cedi',     flag: '🇬🇭', locale: 'en-GH' },
  CAD: { code: 'CAD', symbol: 'C$',  name: 'Canadian Dollar',     unit: 'dollar',   flag: '🇨🇦', locale: 'en-CA' },
  AUD: { code: 'AUD', symbol: 'A$',  name: 'Australian Dollar',   unit: 'dollar',   flag: '🇦🇺', locale: 'en-AU' },
  INR: { code: 'INR', symbol: '₹',   name: 'Indian Rupee',        unit: 'rupee',    flag: '🇮🇳', locale: 'en-IN' },
  JPY: { code: 'JPY', symbol: '¥',   name: 'Japanese Yen',        unit: 'yen',      flag: '🇯🇵', locale: 'ja-JP' },
  CNY: { code: 'CNY', symbol: '¥',   name: 'Chinese Yuan',        unit: 'yuan',     flag: '🇨🇳', locale: 'zh-CN' },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham',          unit: 'dirham',   flag: '🇦🇪', locale: 'ar-AE' },
  ZMW: { code: 'ZMW', symbol: 'ZK',  name: 'Zambian Kwacha',      unit: 'kwacha',   flag: '🇿🇲', locale: 'en-ZM' },
  UGX: { code: 'UGX', symbol: 'USh', name: 'Ugandan Shilling',   unit: 'shilling', flag: '🇺🇬', locale: 'en-UG' },
  TZS: { code: 'TZS', symbol: 'TSh', name: 'Tanzanian Shilling',  unit: 'shilling', flag: '🇹🇿', locale: 'en-TZ' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

export const CURRENCY_LIST = Object.values(CURRENCIES);

/** Format a number as a currency string — e.g. fmt(800000, 'NGN') → '₦800,000' */
export function fmt(amount: number, currency: CurrencyCode = 'NGN'): string {
  const { symbol, locale } = CURRENCIES[currency];
  return symbol + Math.round(amount).toLocaleString(locale);
}

/** Format a raw input string with commas as the user types.
 *  e.g. '800000' → '800,000'  |  '1234567' → '1,234,567' */
export function formatInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  return parseInt(digits, 10).toLocaleString('en-US');
}

/** Strip commas and parse back to a number */
export function parseInput(formatted: string): number {
  return parseInt(formatted.replace(/[^0-9]/g, ''), 10) || 0;
}
