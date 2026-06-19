import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ArticleCategory } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { BorderRadius, Spacing } from '@/constants/Spacing';

interface CategoryChipProps {
  category: ArticleCategory;
  variant?: 'filled' | 'outline';
  size?: 'small' | 'medium';
}

export function CategoryChip({ category, variant = 'filled', size = 'medium' }: CategoryChipProps) {
  const { colors } = useTheme();
  const colorKey = `cat${category}` as keyof typeof colors;
  const categoryColor = colors[colorKey] || colors.brandPrimary;

  const isSmall = size === 'small';

  return (
    <View
      style={[
        styles.chip,
        isSmall && styles.chipSmall,
        variant === 'outline'
          ? { borderColor: categoryColor, backgroundColor: 'transparent' }
          : { backgroundColor: categoryColor + '20' },
      ]}
    >
      <Text
        style={[
          isSmall ? Typography.labelSmall : Typography.labelMedium,
          { color: categoryColor },
        ]}
      >
        {category}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
    alignSelf: 'flex-start',
  },
  chipSmall: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
});
