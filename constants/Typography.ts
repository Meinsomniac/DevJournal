import { Platform, TextStyle } from 'react-native';

interface TypographyStyle extends TextStyle {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const GEIST: Record<string, string> = {
  '400': 'Geist_400Regular',
  '500': 'Geist_500Medium',
  '600': 'Geist_600SemiBold',
  '700': 'Geist_700Bold',
};

const TRACKING = 0.3;

export const Typography = {
  displayLarge: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40, letterSpacing: -0.5, fontFamily: GEIST['700'] },
  displayMedium: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.25, fontFamily: GEIST['700'] },
  displaySmall: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32, fontFamily: GEIST['600'] },

  headlineLarge: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28, fontFamily: GEIST['600'] },
  headlineMedium: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26, fontFamily: GEIST['600'] },
  headlineSmall: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24, fontFamily: GEIST['600'] },

  titleLarge: { fontSize: 18, fontWeight: '500' as const, lineHeight: 24, fontFamily: GEIST['500'] },
  titleMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 22, fontFamily: GEIST['500'] },
  titleSmall: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, fontFamily: GEIST['500'] },

  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24, letterSpacing: TRACKING, fontFamily: GEIST['400'] },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20, letterSpacing: TRACKING, fontFamily: GEIST['400'] },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, letterSpacing: TRACKING, fontFamily: GEIST['400'] },

  labelLarge: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20, fontFamily: GEIST['500'] },
  labelMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16, fontFamily: GEIST['500'] },
  labelSmall: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14, textTransform: 'uppercase' as const, letterSpacing: 0.5, fontFamily: GEIST['500'] },

  monoSmall: { fontSize: 11, fontFamily: MONO, lineHeight: 16, fontWeight: '400' as const },
  monoMedium: { fontSize: 13, fontFamily: MONO, lineHeight: 20, fontWeight: '400' as const },
} as const;
