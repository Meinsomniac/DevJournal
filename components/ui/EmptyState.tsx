import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { LucideIcon, Inbox } from 'lucide-react-native';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Icon size={64} color={colors.textTertiary} strokeWidth={1} />
      <Text style={[Typography.headlineSmall, { color: colors.textPrimary, marginTop: Spacing.lg }]}>
        {title}
      </Text>
      {description && (
        <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>
          {description}
        </Text>
      )}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  action: {
    marginTop: Spacing.lg,
  },
});
