// Steward Design System — Midnight Gold
// Premium dark fintech palette for Africa's emerging middle class

export const COLORS = {
  // ─── Backgrounds ──────────────────────────────────────────────
  bg: '#0C1117',           // Screen background — gunmetal dark
  surface: '#131B24',      // Elevated surface
  card: '#192433',         // Card background
  cardElevated: '#1F2E40', // Elevated card / modal
  border: '#243447',       // Subtle border
  borderLight: '#2E4159',  // Slightly lighter border

  // ─── Gold / Primary Brand ─────────────────────────────────────
  gold: '#C9943F',
  goldLight: '#E8BE70',
  goldDim: '#7A5C28',
  goldBg: 'rgba(201, 148, 63, 0.12)',
  goldBgStrong: 'rgba(201, 148, 63, 0.20)',

  // ─── Emerald / Growth ─────────────────────────────────────────
  emerald: '#10B97A',
  emeraldLight: '#14D98F',
  emeraldBg: 'rgba(16, 185, 122, 0.12)',

  // ─── Text ─────────────────────────────────────────────────────
  textPrimary: '#F2EDE4',   // Warm cream white
  textSecondary: '#8BA4BC', // Cool slate
  textMuted: '#4A6278',     // Very muted

  // ─── Status ───────────────────────────────────────────────────
  success: '#22C55E',
  successBg: 'rgba(34, 197, 94, 0.12)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.12)',
  danger: '#EF4444',
  dangerBg: 'rgba(239, 68, 68, 0.12)',
  info: '#60A5FA',
  infoBg: 'rgba(96, 165, 250, 0.12)',
  purple: '#A78BFA',
  purpleBg: 'rgba(167, 139, 250, 0.12)',
} as const;

export const FONTS = {
  display: 'Fraunces_900Black',         // Hero numbers, grade letters
  heading: 'Fraunces_700Bold',          // Section titles, greetings
  headingItalic: 'Fraunces_700Bold_Italic', // Quotes, taglines
  semibold: 'DMSans_600SemiBold',       // Card titles, labels, CTAs
  medium: 'DMSans_500Medium',           // Body text, descriptions
  regular: 'DMSans_400Regular',         // Secondary text, captions
} as const;

// Allocation bucket color palette — 7 distinct, harmonious on dark bg
export const BUCKET_COLORS = [
  '#C9943F', // Gold — Rent/Housing
  '#10B97A', // Emerald — Food
  '#60A5FA', // Blue — Savings
  '#A78BFA', // Purple — Investments
  '#F472B6', // Pink — Entertainment
  '#F59E0B', // Amber — Emergency
  '#34D399', // Mint — Giving
] as const;
