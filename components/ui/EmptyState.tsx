import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
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

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    translateY.value = withTiming(0, { duration: 400 });
  }, [opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Icon size={64} color={colors.textTertiary} strokeWidth={1} />
      <Text style={[Typography.headlineSmall, { color: colors.textPrimary, marginTop: Spacing.lg }]}>{title}</Text>
      {description && <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' }]}>{description}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl },
  action: { marginTop: Spacing.lg },
});
