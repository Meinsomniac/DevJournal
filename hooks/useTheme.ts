import { useApp } from '@/context/AppContext';

export function useTheme() {
  const { colors, isDark } = useApp();
  return { colors, isDark };
}

export function getColors(isDark: boolean): { colors: typeof import('@/constants/Colors').Colors.dark } {
  const { Colors } = require('@/constants/Colors');
  return { colors: (isDark ? Colors.dark : Colors.light) as typeof Colors.dark };
}
