import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { LucideIcon, Flame, Sparkles, Code, Database, Cloud, Shield, Briefcase, Wrench, Newspaper } from 'lucide-react-native';
import { ArticleCategory } from '@/types';

const CATEGORY_ICONS: Record<ArticleCategory, LucideIcon> = {
  AI: Sparkles,
  Frontend: Code,
  Backend: Database,
  Infrastructure: Cloud,
  Security: Shield,
  Career: Briefcase,
  Tools: Wrench,
  General: Newspaper,
};

interface SectionHeaderProps {
  title: string;
  category?: ArticleCategory;
  breaking?: boolean;
  count?: number;
}

export function SectionHeader({ title, category, breaking, count }: SectionHeaderProps) {
  const { colors } = useTheme();

  const Icon = category ? CATEGORY_ICONS[category] : breaking ? Flame : Newspaper;
  const color = breaking
    ? colors.warning
    : category
    ? colors[`cat${category}` as keyof typeof colors] || colors.textPrimary
    : colors.textPrimary;

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
