/**
 * Nigerian PAYE Tax Calculator
 *
 * Supports:
 *  - PITA (Personal Income Tax Act) — current regime, valid through 31 Dec 2025
 *  - NTA 2025 (Nigeria Tax Act) — signed 26 Jun 2025, effective 1 Jan 2026
 *
 * All three major jurisdictions (Lagos LIRS, FCT-IRS, Enugu ESIRS) use the
 * same federal PAYE rate schedule. State logic only differs in display name.
 *
 * Sources:
 *  - PwC Nigeria Tax Summaries 2024/2025
 *  - EY Nigeria Tax Act 2025 Alert
 *  - KPMG NTA 2025 Analysis
 *  - Pension Reform Act 2014 (8 % employee contribution)
 */

export type NigerianState = 'Lagos' | 'Abuja (FCT)' | 'Enugu' | 'Other';
export type TaxRegime   = 'PITA_2024' | 'NTA_2025';

// ─── Band definitions ─────────────────────────────────────────────────────────

/** PITA bands: cumulative ceiling of each band (not the width). */
const PITA_CEILINGS = [
  { ceiling: 300_000,    rate: 0.07 },
  { ceiling: 600_000,    rate: 0.11 },
  { ceiling: 1_100_000,  rate: 0.15 },
  { ceiling: 1_600_000,  rate: 0.19 },
  { ceiling: 3_200_000,  rate: 0.21 },
  { ceiling: Infinity,   rate: 0.24 },
];

/** NTA 2025 bands — effective 1 Jan 2026. */
const NTA_CEILINGS = [
  { ceiling: 800_000,    rate: 0.00 },
  { ceiling: 3_000_000,  rate: 0.15 },
  { ceiling: 12_000_000, rate: 0.18 },
  { ceiling: 50_000_000, rate: 0.21 },
  { ceiling: Infinity,   rate: 0.25 },
];

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TaxBandBreakdown {
  label: string;       // e.g. "First ₦300,000 @ 7%"
  rate: number;        // 0.07
  taxableAmount: number;
  taxDue: number;
}

export interface TaxResult {
  regime:              TaxRegime;
  annualGross:         number;
  pensionDeduction:    number;   // 8 % of pensionable base
  cra:                 number;   // Consolidated Relief Allowance (PITA only; 0 for NTA)
  taxableIncome:       number;
  annualTax:           number;
  minimumTax:          number;   // 1 % of gross (PITA only)
  minimumTaxApplied:   boolean;
  effectiveAnnualTax:  number;   // max(annualTax, minimumTax) for PITA
  monthlyTax:          number;
  effectiveRate:       number;   // percentage
  isExempt:            boolean;  // below minimum-wage threshold
  netAnnualIncome:     number;
  netMonthlyIncome:    number;
  bands:               TaxBandBreakdown[];
  // Formatted helpers
  stateAuthority:      string;   // "Lagos Internal Revenue Service (LIRS)"
}

// ─── Core calculator ──────────────────────────────────────────────────────────

/**
 * Compute PAYE tax for a Nigerian employee.
 *
 * @param annualGross    Total gross annual income in NGN
 * @param state          Residential state for display / authority info
 * @param pensionBase    Basic + Housing + Transport allowance (defaults to 40 % of gross)
 * @param forceRegime    Override auto regime selection (defaults to current year)
 */
export function calculatePAYE(
  annualGross: number,
  state: NigerianState = 'Lagos',
  pensionBase?: number,
  forceRegime?: TaxRegime,
): TaxResult {
  const currentYear = new Date().getFullYear();
  const regime: TaxRegime =
    forceRegime ?? (currentYear >= 2026 ? 'NTA_2025' : 'PITA_2024');

  // ── Pension deduction (8 % of pensionable base) ──────────────────────────
  const pb = pensionBase ?? annualGross * 0.40;  // assume 40 % of gross if not specified
  const pensionDeduction = pb * 0.08;

  // ── Minimum-wage exemption ────────────────────────────────────────────────
  // PITA (Finance Act 2024): ≤ ₦70 k/month (₦840 k/year) → exempt
  // NTA 2025: first ₦800 k of taxable income @ 0 % (handled by band)
  const EXEMPT_THRESHOLD_PITA = 840_000;
  const isExempt = regime === 'PITA_2024' && annualGross <= EXEMPT_THRESHOLD_PITA;

  // ── CRA (PITA only) ───────────────────────────────────────────────────────
  // Higher of (₦200,000 or 1 % of gross) + 20 % of gross
  let cra = 0;
  if (regime === 'PITA_2024' && !isExempt) {
    const floor = Math.max(200_000, annualGross * 0.01);
    cra = floor + annualGross * 0.20;
  }

  // ── Taxable income ────────────────────────────────────────────────────────
  const taxableIncome = Math.max(0, annualGross - pensionDeduction - cra);

  // ── Tax computation ───────────────────────────────────────────────────────
  const bands = regime === 'PITA_2024' ? PITA_CEILINGS : NTA_CEILINGS;
  const breakdown: TaxBandBreakdown[] = [];
  let annualTax = 0;
  let remaining = taxableIncome;
  let prevCeiling = 0;

  for (const { ceiling, rate } of bands) {
    if (remaining <= 0) break;
    const bandWidth = ceiling === Infinity ? remaining : Math.min(ceiling - prevCeiling, remaining);
    const taxable   = Math.min(bandWidth, remaining);
    const due       = taxable * rate;
    if (taxable > 0) {
      const lo = prevCeiling + 1;
      const hi = ceiling === Infinity ? '∞' : ceiling.toLocaleString('en-NG');
      breakdown.push({
        label: ceiling === Infinity
          ? `Above ₦${prevCeiling.toLocaleString('en-NG')} @ ${(rate * 100).toFixed(0)}%`
          : `₦${lo.toLocaleString('en-NG')} – ₦${(prevCeiling + bandWidth).toLocaleString('en-NG')} @ ${(rate * 100).toFixed(0)}%`,
        rate,
        taxableAmount: taxable,
        taxDue: due,
      });
    }
    annualTax += due;
    remaining -= taxable;
    if (ceiling !== Infinity) prevCeiling = ceiling;
  }

  // ── Minimum tax (PITA only) ───────────────────────────────────────────────
  const minimumTax = regime === 'PITA_2024' && !isExempt ? annualGross * 0.01 : 0;
  const minimumTaxApplied = !isExempt && minimumTax > annualTax;
  const effectiveAnnualTax = isExempt ? 0 : Math.max(annualTax, minimumTax);
  const monthlyTax = effectiveAnnualTax / 12;

  const stateMap: Record<NigerianState, string> = {
    'Lagos':       'Lagos Internal Revenue Service (LIRS)',
    'Abuja (FCT)': 'FCT Internal Revenue Service (FCT-IRS)',
    'Enugu':       'Enugu State Internal Revenue Service (ESIRS)',
    'Other':       'State Internal Revenue Service',
  };

  const netAnnualIncome  = annualGross - pensionDeduction - effectiveAnnualTax;
  const netMonthlyIncome = netAnnualIncome / 12;

  return {
    regime,
    annualGross,
    pensionDeduction,
    cra,
    taxableIncome,
    annualTax,
    minimumTax,
    minimumTaxApplied,
    effectiveAnnualTax,
    monthlyTax,
    effectiveRate: annualGross > 0 ? (effectiveAnnualTax / annualGross) * 100 : 0,
    isExempt,
    netAnnualIncome,
    netMonthlyIncome,
    bands: isExempt ? [] : breakdown,
    stateAuthority: stateMap[state],
  };
}

// ─── Convenience: monthly input → PAYE result ────────────────────────────────
export function calculatePAYEFromMonthly(
  monthlyGross: number,
  state: NigerianState = 'Lagos',
  pensionBase?: number,
  forceRegime?: TaxRegime,
): TaxResult {
  return calculatePAYE(
    monthlyGross * 12,
    state,
    pensionBase !== undefined ? pensionBase * 12 : undefined,
    forceRegime,
  );
}

// ─── Labels ───────────────────────────────────────────────────────────────────
export const STATE_OPTIONS: NigerianState[] = ['Lagos', 'Abuja (FCT)', 'Enugu', 'Other'];

export const REGIME_LABEL: Record<TaxRegime, string> = {
  PITA_2024: 'PITA (Current — 2024/2025)',
  NTA_2025:  'NTA 2025 (Effective Jan 2026)',
};
