export const Colors = {
  light: {
    bgPrimary: '#FFFFFF',
    bgSecondary: '#F8FAFC',
    bgTertiary: '#F1F5F9',
    bgCard: '#FFFFFF',
    bgCardHover: '#F8FAFC',

    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textTertiary: '#94A3B8',
    textInverse: '#FFFFFF',

    brandPrimary: '#0EA5E9',
    brandPrimaryDark: '#0284C7',
    brandSecondary: '#8B5CF6',

    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#0EA5E9',

    borderLight: '#E2E8F0',
    borderMedium: '#CBD5E1',

    catAI: '#8B5CF6',
    catReact: '#61DAFB',
    catBackend: '#10B981',
    catInfra: '#F59E0B',
    catSecurity: '#EF4444',
    catCareer: '#EC4899',
    catTools: '#6366F1',
  },

  dark: {
    bgPrimary: '#020617',
    bgSecondary: '#0F172A',
    bgTertiary: '#1E293B',
    bgCard: '#0F172A',
    bgCardHover: '#1E293B',

    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    textInverse: '#0F172A',

    brandPrimary: '#38BDF8',
    brandPrimaryDark: '#0EA5E9',
    brandSecondary: '#A78BFA',

    success: '#34D399',
    warning: '#FBBF24',
    error: '#F87171',
    info: '#38BDF8',

    borderLight: '#1E293B',
    borderMedium: '#334155',

    catAI: '#A78BFA',
    catReact: '#22D3EE',
    catBackend: '#34D399',
    catInfra: '#FBBF24',
    catSecurity: '#F87171',
    catCareer: '#F472B6',
    catTools: '#818CF8',
  },
} as const;

export type ColorScheme = typeof Colors.light | typeof Colors.dark;
