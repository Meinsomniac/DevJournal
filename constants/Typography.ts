import { TextStyle } from 'react-native';

interface TypographyStyle extends TextStyle {
  fontSize: number;
  fontWeight: '400' | '500' | '600' | '700';
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase';
}

export const Typography = {
  displayLarge: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40, letterSpacing: -0.5 },
  displayMedium: { fontSize: 28, fontWeight: '700' as const, lineHeight: 36, letterSpacing: -0.25 },
  displaySmall: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },

  headlineLarge: { fontSize: 22, fontWeight: '600' as const, lineHeight: 28 },
  headlineMedium: { fontSize: 20, fontWeight: '600' as const, lineHeight: 26 },
  headlineSmall: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },

  titleLarge: { fontSize: 18, fontWeight: '500' as const, lineHeight: 24 },
  titleMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 22 },
  titleSmall: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },

  bodyLarge: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },

  labelLarge: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  labelMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
  labelSmall: { fontSize: 11, fontWeight: '500' as const, lineHeight: 14, textTransform: 'uppercase' as const, letterSpacing: 0.5 },

  monoSmall: { fontSize: 11, fontFamily: 'monospace', lineHeight: 16, fontWeight: '400' as const },
  monoMedium: { fontSize: 13, fontFamily: 'monospace', lineHeight: 20, fontWeight: '400' as const },
} as const;
