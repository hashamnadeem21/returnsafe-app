/**
 * ReturnSafe design tokens — the ONLY file in src/ allowed to contain hex colours.
 * Values match ReturnSafe-Design.pdf pages 2–4 (scripts/check-no-hex.mjs enforces this).
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export type Palette = {
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryLine: string;
  onPrimary: string;
  warning: string;
  warningText: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  onDanger: string;
  success: string;
  successSoft: string;
  ink: string;
  ink2: string;
  muted: string;
  border: string;
  bg: string;
  surface: string;
  bannerWarnText: string;
  bannerInfoText: string;
  bannerOfflineBg: string;
  bannerOfflineText: string;
  scrim: string;
  shadow: string;
  skeletonHighlight: string;
  /** Teal brand fill used by splash and onboarding art in both themes. */
  brand: string;
  white: string;
  /** Google sign-in button (Google brand guidelines: light / dark neutral). */
  googleBg: string;
  googleFg: string;
  googleBorder: string;
};

const light: Palette = {
  primary: '#0F766E',
  primaryPressed: '#115E59',
  primarySoft: '#CCFBF1',
  primaryLine: '#99F6E4',
  onPrimary: '#FFFFFF',
  warning: '#F59E0B',
  warningText: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  onDanger: '#FFFFFF',
  success: '#16A34A',
  successSoft: '#DCFCE7',
  ink: '#0F172A',
  ink2: '#475569',
  muted: '#94A3B8',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  bannerWarnText: '#78350F',
  bannerInfoText: '#134E4A',
  bannerOfflineBg: '#1E293B',
  bannerOfflineText: '#F1F5F9',
  scrim: 'rgba(15,23,42,0.45)',
  shadow: '#0F172A',
  skeletonHighlight: '#F1F5F9',
  brand: '#0F766E',
  white: '#FFFFFF',
  googleBg: '#FFFFFF',
  googleFg: '#1F1F1F',
  googleBorder: '#DADCE0',
};

const dark: Palette = {
  primary: '#2DD4BF',
  primaryPressed: '#14B8A6',
  primarySoft: '#134E4A',
  primaryLine: '#115E59',
  onPrimary: '#04201D',
  warning: '#FBBF24',
  warningText: '#FBBF24',
  warningSoft: '#422006',
  danger: '#F87171',
  dangerSoft: '#450A0A',
  onDanger: '#450A0A',
  success: '#4ADE80',
  successSoft: '#052E16',
  ink: '#F1F5F9',
  ink2: '#94A3B8',
  muted: '#64748B',
  border: '#1F2937',
  bg: '#0B1220',
  surface: '#111827',
  bannerWarnText: '#FDE68A',
  bannerInfoText: '#99F6E4',
  bannerOfflineBg: '#1E293B',
  bannerOfflineText: '#F1F5F9',
  scrim: 'rgba(0,0,0,0.6)',
  shadow: '#000000',
  skeletonHighlight: '#1F2937',
  brand: '#0F766E',
  white: '#FFFFFF',
  googleBg: '#131314',
  googleFg: '#E3E3E3',
  googleBorder: '#8E918F',
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

/** Letter-avatar colours [background, text], keyed by first letter. */
export const avatarColors: Record<string, readonly [string, string]> = {
  T: ['#FEE2E2', '#B91C1C'],
  A: ['#FEF3C7', '#92400E'],
  B: ['#DBEAFE', '#1D4ED8'],
  W: ['#E0F2FE', '#0369A1'],
  C: ['#EDE9FE', '#6D28D9'],
  H: ['#FFEDD5', '#C2410C'],
  I: ['#FEF9C3', '#854D0E'],
  J: ['#DCFCE7', '#15803D'],
  K: ['#FCE7F3', '#BE185D'],
  L: ['#E0E7FF', '#4338CA'],
};
/** Google "G" logo colours (fixed by Google's brand guidelines). */
export const googleLogoColors = {
  red: '#EA4335',
  blue: '#4285F4',
  yellow: '#FBBC05',
  green: '#34A853',
} as const;

export const avatarFallback = ['#E2E8F0', '#334155'] as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

export type TypeVariant = 'display' | 'title' | 'headline' | 'body' | 'caption' | 'label';

export const type: Record<TypeVariant, TextStyle> = {
  display: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.4 },
  title: { fontFamily: fonts.semibold, fontSize: 22, lineHeight: 28, letterSpacing: -0.2 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
};

/** Max Dynamic Type / font scale multiplier for all text. */
export const maxFontSizeMultiplier = 1.4;
/** Tab bar labels share a fixed-width bar, so they grow less (system tab bars do not scale at all). */
export const tabLabelMaxFontSizeMultiplier = 1.1;

/** 4-point grid. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  screen: 20,
} as const;

export const radii = {
  card: 16,
  button: 14,
  input: 12,
  avatar: 12,
  banner: 12,
  sheet: 24,
  chip: 999,
} as const;

export const sizes = {
  tapTarget: 48,
  button: 52,
  textButton: 48,
  input: 52,
  chip: 34,
  pill: 26,
  avatar: 42,
  tabBar: 64,
  scanFab: 56,
  icon: 22,
  hairline: 1,
  inputBorder: 1.5,
} as const;

export const shadows = {
  card: (color: string): ViewStyle =>
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: color,
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      default: { elevation: 1 },
    }),
  fab: (color: string): ViewStyle =>
    Platform.select<ViewStyle>({
      ios: {
        shadowColor: color,
        shadowOpacity: 0.35,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 6 },
      },
      default: { elevation: 6 },
    }),
};

export const motion = { fast: 150, normal: 250 } as const;

export type Theme = {
  scheme: ColorScheme;
  colors: Palette;
  type: typeof type;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
};

export function buildTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: palettes[scheme], type, spacing, radii, sizes };
}
