// Steward Design System — Obsidian (dark) + Warm Parchment (light)
// Colour tokens derived from the Steward Obsidian design language

// ─── Dark Palette — "Obsidian" ────────────────────────────────────────────────
export const DARK_COLORS = {
  bg:           '#121415',   // background
  surface:      '#1a1c1d',   // surface-container-low
  card:         '#1e2021',   // surface-container
  cardElevated: '#282a2b',   // surface-container-high
  border:       '#4e4639',   // outline-variant
  borderLight:  '#9a8f80',   // outline

  gold:         '#ebc076',   // primary
  goldLight:    '#ffdeaa',   // primary-fixed
  goldDim:      '#b18b46',   // primary-container
  goldBg:       'rgba(235,192,118,0.10)',
  goldBgStrong: 'rgba(235,192,118,0.20)',

  emerald:      '#10B97A',
  emeraldLight: '#34D399',
  emeraldBg:    'rgba(16,185,122,0.12)',

  textPrimary:   '#e2e2e3',  // on-surface
  textSecondary: '#d2c5b4',  // on-surface-variant
  textMuted:     '#9a8f80',  // outline

  secondary:  '#b9cbc1',
  tertiary:   '#e3bfb2',

  success:    '#22C55E',
  successBg:  'rgba(34,197,94,0.12)',
  warning:    '#F59E0B',
  warningBg:  'rgba(245,158,11,0.12)',
  danger:     '#EF4444',
  dangerBg:   'rgba(239,68,68,0.12)',
  info:       '#60A5FA',
  infoBg:     'rgba(96,165,250,0.12)',
  purple:     '#A78BFA',
  purpleBg:   'rgba(167,139,250,0.12)',
  pink:       '#F472B6',
  pinkBg:     'rgba(244,114,182,0.12)',

  shadow:     'transparent',
  overlay:    'rgba(0,0,0,0.75)',
} as const;

// ─── Light Palette — "Warm Parchment" ────────────────────────────────────────
export const LIGHT_COLORS = {
  bg:           '#fdf9f3',   // background
  surface:      '#f7f3ed',   // surface-container-low
  card:         '#ffffff',   // surface-container-lowest
  cardElevated: '#ebe8e2',   // surface-container-high
  border:       '#d2c5b4',   // outline-variant
  borderLight:  '#e6e2dc',   // surface-container-highest

  gold:         '#775616',   // primary
  goldLight:    '#ebc076',   // inverse-primary / primary-fixed-dim
  goldDim:      '#d2c5b4',   // outline-variant as muted gold
  goldBg:       'rgba(119,86,22,0.08)',
  goldBgStrong: 'rgba(119,86,22,0.14)',

  emerald:      '#0A9660',
  emeraldLight: '#10B97A',
  emeraldBg:    'rgba(10,150,96,0.10)',

  textPrimary:   '#1c1c18',  // on-surface
  textSecondary: '#4e4639',  // on-surface-variant
  textMuted:     '#807667',  // outline

  secondary:  '#596060',
  tertiary:   '#625b51',

  success:    '#16A34A',
  successBg:  'rgba(22,163,74,0.10)',
  warning:    '#B45309',
  warningBg:  'rgba(180,83,9,0.10)',
  danger:     '#DC2626',
  dangerBg:   'rgba(220,38,38,0.10)',
  info:       '#1D4ED8',
  infoBg:     'rgba(29,78,216,0.10)',
  purple:     '#6D28D9',
  purpleBg:   'rgba(109,40,217,0.10)',
  pink:       '#BE185D',
  pinkBg:     'rgba(190,24,93,0.10)',

  shadow:     'rgba(28,28,24,0.10)',
  overlay:    'rgba(28,28,24,0.50)',
} as const;

export const COLORS = DARK_COLORS;

export type ColorPalette = {
  [K in keyof typeof DARK_COLORS]: string;
};

// ─── Fonts ────────────────────────────────────────────────────────────────────
// Fraunces = editorial serif (maps to Newsreader role in designs)
// DMSans   = clean geometric sans (maps to Manrope/Inter roles)
export const FONTS = {
  display:       'Fraunces_900Black',       // hero numbers, grade letters
  heading:       'Fraunces_700Bold',        // section titles
  headingItalic: 'Fraunces_700Bold_Italic', // italic serif quotes, advisory text, hero amounts
  semibold:      'DMSans_600SemiBold',
  medium:        'DMSans_500Medium',
  regular:       'DMSans_400Regular',
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
} as const;

// ─── Border Radii ─────────────────────────────────────────────────────────────
export const RADII = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
} as const;

// ─── Shadows (light mode only — dark uses borders) ───────────────────────────
export const SHADOWS = {
  sm: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,  elevation: 2 },
  md: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8,  elevation: 4 },
  lg: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 8 },
} as const;

// ─── Allocation bucket palette ────────────────────────────────────────────────
export const BUCKET_COLORS = [
  '#ebc076', // Gold      — Rent/Housing
  '#10B97A', // Emerald   — Food
  '#60A5FA', // Blue      — Savings
  '#A78BFA', // Purple    — Investments
  '#F472B6', // Pink      — Entertainment
  '#F59E0B', // Amber     — Emergency
  '#34D399', // Mint      — Giving
  '#b9cbc1', // Sage      — Covenant Practice
] as const;

export const CUSTOM_BUCKET_COLORS = [
  '#06B6D4',
  '#FB923C',
  '#84CC16',
  '#E879F9',
  '#2DD4BF',
  '#F97316',
  '#38BDF8',
] as const;

export const BUCKET_DEFAULTS = [
  { name: 'Rent & Housing',    icon: 'home-outline',             color: BUCKET_COLORS[0], defaultPct: 25 },
  { name: 'Food & Groceries',  icon: 'restaurant-outline',       color: BUCKET_COLORS[1], defaultPct: 10 },
  { name: 'Savings',           icon: 'trending-up-outline',      color: BUCKET_COLORS[2], defaultPct: 20 },
  { name: 'Investments',       icon: 'stats-chart-outline',      color: BUCKET_COLORS[3], defaultPct: 10 },
  { name: 'Entertainment',     icon: 'musical-notes-outline',    color: BUCKET_COLORS[4], defaultPct: 5  },
  { name: 'Emergency Fund',    icon: 'shield-checkmark-outline', color: BUCKET_COLORS[5], defaultPct: 15 },
  { name: 'Giving',            icon: 'heart-outline',            color: BUCKET_COLORS[6], defaultPct: 5  },
  { name: 'Covenant Practice', icon: 'infinite-outline',         color: BUCKET_COLORS[7], defaultPct: 10 },
] as const;
