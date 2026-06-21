export const Colors = {
  light: {
    bgPrimary: '#dbdbd7',
    bgSecondary: '#d4d4d1',
    bgTertiary: '#c1c1be',
    bgCard: '#cfcfc9',
    bgCardHover: '#c9c9c4',

    textPrimary: '#262626',
    textSecondary: '#666666',
    textTertiary: '#808080',
    textInverse: '#f3f3f2',

    brandPrimary: '#333333',
    brandPrimaryDark: '#292929',
    brandSecondary: '#998466',

    success: '#577c5c',
    warning: '#9c7a42',
    error: '#993333',
    info: '#5c6970',

    borderLight: '#c2c2bc',
    borderMedium: '#999999',

  },

  dark: {
    bgPrimary: '#0e0e11',
    bgSecondary: '#0c0c0e',
    bgTertiary: '#1c1c22',
    bgCard: '#121216',
    bgCardHover: '#141418',

    textPrimary: '#afb6b6',
    textSecondary: '#6d6d78',
    textTertiary: '#54545e',
    textInverse: '#0a0a0f',

    brandPrimary: '#85adad',
    brandPrimaryDark: '#6a8e8e',
    brandSecondary: '#36293d',

    success: '#5c8e67',
    warning: '#af8842',
    error: '#7a1f1f',
    info: '#82a7a6',

    borderLight: '#17171c',
    borderMedium: '#242428',
  },
} as const;

export type ColorScheme = typeof Colors.light | typeof Colors.dark;
