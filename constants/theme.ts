// Steward Design System — Midnight Gold (dark) + Warm Parchment (light)

// ─── Dark Palette ─────────────────────────────────────────────────────────────
export const DARK_COLORS = {
  bg: '#0C1117',
  surface: '#131B24',
  card: '#192433',
  cardElevated: '#1F2E40',
  border: '#243447',
  borderLight: '#2E4159',

  gold: '#C9943F',
  goldLight: '#E8BE70',
  goldDim: '#7A5C28',
  goldBg: 'rgba(201, 148, 63, 0.12)',
  goldBgStrong: 'rgba(201, 148, 63, 0.22)',

  emerald: '#10B97A',
  emeraldLight: '#14D98F',
  emeraldBg: 'rgba(16, 185, 122, 0.12)',

  textPrimary: '#F2EDE4',
  textSecondary: '#8BA4BC',
  textMuted: '#4A6278',

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
  pink: '#F472B6',
  pinkBg: 'rgba(244, 114, 182, 0.12)',

  shadow: 'transparent',
  overlay: 'rgba(0,0,0,0.72)',
} as const;

// ─── Light Palette — "Warm Parchment" ────────────────────────────────────────
export const LIGHT_COLORS = {
  bg: '#F4EFE6',           // Warm parchment
  surface: '#FFFDF9',
  card: '#FFFFFF',
  cardElevated: '#FDF8F0',
  border: '#E8E1D4',
  borderLight: '#EEE9E0',

  gold: '#A0722A',
  goldLight: '#C9943F',
  goldDim: '#D4B896',
  goldBg: 'rgba(160, 114, 42, 0.08)',
  goldBgStrong: 'rgba(160, 114, 42, 0.14)',

  emerald: '#0A9660',
  emeraldLight: '#10B97A',
  emeraldBg: 'rgba(10, 150, 96, 0.10)',

  textPrimary: '#12202E',
  textSecondary: '#4E6478',
  textMuted: '#8FA3B5',

  success: '#16A34A',
  successBg: 'rgba(22, 163, 74, 0.10)',
  warning: '#B45309',
  warningBg: 'rgba(180, 83, 9, 0.10)',
  danger: '#DC2626',
  dangerBg: 'rgba(220, 38, 38, 0.10)',
  info: '#1D4ED8',
  infoBg: 'rgba(29, 78, 216, 0.10)',
  purple: '#6D28D9',
  purpleBg: 'rgba(109, 40, 217, 0.10)',
  pink: '#BE185D',
  pinkBg: 'rgba(190, 24, 93, 0.10)',

  shadow: 'rgba(18, 32, 46, 0.10)',
  overlay: 'rgba(18, 32, 46, 0.5)',
} as const;

export const COLORS = DARK_COLORS;

export type ColorPalette = {
  [K in keyof typeof DARK_COLORS]: string;
};

// ─── Fonts ────────────────────────────────────────────────────────────────────
export const FONTS = {
  display: 'Fraunces_900Black',
  heading: 'Fraunces_700Bold',
  headingItalic: 'Fraunces_700Bold_Italic',
  semibold: 'DMSans_600SemiBold',
  medium: 'DMSans_500Medium',
  regular: 'DMSans_400Regular',
} as const;

// ─── Spacing ─────────────────────────────────────────────────────────────────
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

// ─── Border Radii ─────────────────────────────────────────────────────────────
export const RADII = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  full: 9999,
} as const;

// ─── Shadows (light mode only — dark uses borders) ───────────────────────────
export const SHADOWS = {
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// ─── Allocation bucket palette ────────────────────────────────────────────────
export const BUCKET_COLORS = [
  '#C9943F', // Gold      — Rent/Housing
  '#10B97A', // Emerald   — Food
  '#60A5FA', // Blue      — Savings
  '#A78BFA', // Purple    — Investments
  '#F472B6', // Pink      — Entertainment
  '#F59E0B', // Amber     — Emergency
  '#34D399', // Mint      — Giving
  '#818CF8', // Indigo    — Covenant Practice
] as const;

export const CUSTOM_BUCKET_COLORS = [
  '#06B6D4', // Cyan
  '#FB923C', // Orange
  '#84CC16', // Lime
  '#E879F9', // Fuchsia
  '#2DD4BF', // Teal
  '#F97316', // Deep orange
  '#38BDF8', // Sky
] as const;

export const BUCKET_DEFAULTS = [
  { name: 'Rent & Housing',     icon: 'home-outline',               color: BUCKET_COLORS[0], defaultPct: 25 },
  { name: 'Food & Groceries',   icon: 'restaurant-outline',         color: BUCKET_COLORS[1], defaultPct: 10 },
  { name: 'Savings',            icon: 'business-outline',           color: BUCKET_COLORS[2], defaultPct: 20 },
  { name: 'Investments',        icon: 'trending-up-outline',        color: BUCKET_COLORS[3], defaultPct: 10 },
  { name: 'Entertainment',      icon: 'musical-notes-outline',      color: BUCKET_COLORS[4], defaultPct: 5  },
  { name: 'Emergency Fund',     icon: 'shield-checkmark-outline',   color: BUCKET_COLORS[5], defaultPct: 15 },
  { name: 'Giving',             icon: 'heart-outline',              color: BUCKET_COLORS[6], defaultPct: 5  },
  { name: 'Covenant Practice',  icon: 'infinite-outline',           color: BUCKET_COLORS[7], defaultPct: 10 },
] as const;
