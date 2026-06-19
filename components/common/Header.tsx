import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Settings, Bell } from 'lucide-react-native';

interface HeaderProps {
  title: string;
  subtitle?: string;
  showSettings?: boolean;
  showNotifications?: boolean;
  onSettingsPress?: () => void;
  onNotificationPress?: () => void;
  rightContent?: React.ReactNode;
}

export function Header({
  title,
  subtitle,
  showSettings,
  showNotifications,
  onSettingsPress,
  onNotificationPress,
  rightContent,
}: HeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={styles.leftContent}>
          <Text style={[Typography.headlineLarge, { color: colors.textPrimary }]}>
            {title}
          </Text>
          {subtitle && (
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: 2 }]}>
              {subtitle}
            </Text>
          )}
        </View>
        <View style={styles.rightContent}>
          {rightContent}
          {showNotifications && (
            <TouchableOpacity onPress={onNotificationPress} style={styles.iconButton}>
              <Bell size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
          {showSettings && (
            <TouchableOpacity onPress={onSettingsPress} style={styles.iconButton}>
              <Settings size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftContent: {
    flex: 1,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    padding: Spacing.sm,
  },
});
