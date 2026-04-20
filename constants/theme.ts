// Steward Design System — Royal Burgundy
// Colour tokens derived from the Steward Royal Burgundy design language
// Burgundy = primary action colour · Gold = accent / highlight colour

// ─── Dark Palette — "Royal Burgundy" ─────────────────────────────────────────
export const DARK_COLORS = {
  bg:           '#1a0505',   // deep burgundy background
  surface:      '#1e0707',   // surface-container-lowest
  card:         '#2e1413',   // surface-container-low
  cardElevated: '#3f2221',   // surface-container-high
  border:       '#554240',   // outline-variant
  borderLight:  '#a38b89',   // outline

  // Burgundy — primary action colour (CTA buttons, header)
  burgundy:     '#4E0B0B',   // primary burgundy
  burgundyNav:  '#210909',   // nav bar / pill background

  // Gold — accent / highlight (numbers, progress bars, active states)
  gold:         '#D4AF37',   // primary gold
  goldLight:    '#F0D060',   // gold light / fixed
  goldDim:      '#B38F2D',   // gold dim
  goldBg:       'rgba(212,175,55,0.10)',
  goldBgStrong: 'rgba(212,175,55,0.22)',

  emerald:      '#10B97A',
  emeraldLight: '#34D399',
  emeraldBg:    'rgba(16,185,122,0.12)',

  textPrimary:   '#ffdad8',  // on-surface (warm rose-white)
  textSecondary: '#dbc1be',  // on-surface-variant
  textMuted:     '#a38b89',  // outline

  secondary:  '#ffb3ac',     // secondary container
  tertiary:   '#c8c8b0',     // tertiary

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

// ─── Light Palette — "Royal Burgundy Light" ───────────────────────────────────
export const LIGHT_COLORS = {
  bg:           '#f9f9f9',   // near-neutral white background
  surface:      '#f3f3f4',   // surface-container-low
  card:         '#ffffff',   // pure white card
  cardElevated: '#eeeeee',   // surface-container
  border:       '#887270',   // outline
  borderLight:  '#dbc1be',   // outline-variant

  // Burgundy — primary action colour
  burgundy:     '#4E0B0B',   // primary CTA / header
  burgundyNav:  '#210909',   // nav accent

  // Gold — accent / highlight
  gold:         '#D4AF37',   // primary gold accent
  goldLight:    '#F0D060',   // gold light
  goldDim:      '#B38F2D',   // gold dim
  goldBg:       'rgba(212,175,55,0.09)',
  goldBgStrong: 'rgba(212,175,55,0.18)',

  emerald:      '#0A9660',
  emeraldLight: '#10B97A',
  emeraldBg:    'rgba(10,150,96,0.10)',

  textPrimary:   '#161000',  // near-black primary text
  textSecondary: '#462827',  // dark burgundy secondary text
  textMuted:     '#887270',  // muted / outline colour

  secondary:  '#99443e',     // mid-burgundy secondary
  tertiary:   '#474836',     // on-tertiary-fixed-variant

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

  shadow:     'rgba(22,16,0,0.10)',
  overlay:    'rgba(22,16,0,0.50)',
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
  '#D4AF37', // Gold      — Rent/Housing
  '#10B97A', // Emerald   — Food
  '#60A5FA', // Blue      — Savings
  '#A78BFA', // Purple    — Investments
  '#F472B6', // Pink      — Entertainment
  '#F59E0B', // Amber     — Emergency
  '#34D399', // Mint      — Giving
  '#c8c8b0', // Sage      — Covenant Practice
  '#06B6D4', // Cyan      — Utilities
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
  { name: 'Rent & Housing',    icon: 'home-outline',             color: BUCKET_COLORS[0], defaultPct: 22 },
  { name: 'Food & Groceries',  icon: 'restaurant-outline',       color: BUCKET_COLORS[1], defaultPct: 10 },
  { name: 'Savings',           icon: 'trending-up-outline',      color: BUCKET_COLORS[2], defaultPct: 20 },
  { name: 'Investments',       icon: 'stats-chart-outline',      color: BUCKET_COLORS[3], defaultPct: 10 },
  { name: 'Entertainment',     icon: 'musical-notes-outline',    color: BUCKET_COLORS[4], defaultPct: 5  },
  { name: 'Emergency Fund',    icon: 'shield-checkmark-outline', color: BUCKET_COLORS[5], defaultPct: 13 },
  { name: 'Giving',            icon: 'heart-outline',            color: BUCKET_COLORS[6], defaultPct: 5  },
  { name: 'Covenant Practice', icon: 'infinite-outline',         color: BUCKET_COLORS[7], defaultPct: 10 },
  { name: 'Utilities',         icon: 'flash-outline',            color: BUCKET_COLORS[8], defaultPct: 5  },
] as const;
