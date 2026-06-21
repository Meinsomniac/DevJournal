import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Flame, Newspaper } from 'lucide-react-native';

interface SectionHeaderProps {
  title: string;
  breaking?: boolean;
  count?: number;
}

export function SectionHeader({ title, breaking, count }: SectionHeaderProps) {
  const { colors } = useTheme();

  const Icon = breaking ? Flame : Newspaper;
  const color = breaking ? colors.warning : colors.textPrimary;

  return (
    <View style={styles.container}>
      <View style={styles.iconTitle}>
        <Icon size={20} color={color} />
        <Text style={[Typography.headlineMedium, { color, marginLeft: Spacing.sm }]}>
          {title}
        </Text>
      </View>
      {count !== undefined && (
        <Text style={[Typography.labelMedium, { color: colors.textTertiary }]}>
          {count} {count === 1 ? 'story' : 'stories'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  iconTitle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
