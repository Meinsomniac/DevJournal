import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { clearCache, clearAllData, getStorageStats } from '@/services/db';
import { formatDate } from '@/utils/date';
import {
  Moon,
  Sun,
  Monitor,
  Trash2,
  Database,
  Info,
  Shield,
  FileText,
  ExternalLink,
} from 'lucide-react-native';

type ThemeMode = 'system' | 'light' | 'dark';

export default function SettingsScreen() {
  const {
    colors,
    themeMode,
    setThemeMode,
    compactMode,
    setCompactMode,
    autoMarkRead,
    setAutoMarkRead,
    notifyBreaking,
    setNotifyBreaking,
    bumpDataVersion,
  } = useApp();
  const insets = useSafeAreaInsets();

  const [storageStats, setStorageStats] = useState({ count: 0, oldestDate: null as number | null });

  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await getStorageStats();
        setStorageStats(stats);
      } catch (error) {
        console.error('Failed to load storage stats:', error);
      }
    };
    loadStats();
  }, []);

  const handleClearCache = useCallback(async () => {
    try {
      await clearCache();
      const stats = await getStorageStats();
      setStorageStats(stats);
      bumpDataVersion();
      Alert.alert('Cache Cleared', 'All non-bookmarked articles have been removed.');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }, [bumpDataVersion]);

  const handleClearAll = useCallback(() => {
    Alert.alert(
      'Clear All Data',
      'This will delete all articles, bookmarks, and reading history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearAllData();
              const stats = await getStorageStats();
              setStorageStats(stats);
              bumpDataVersion();
              Alert.alert('Data Cleared', 'All data has been removed.');
            } catch (error) {
              console.error('Failed to clear all data:', error);
            }
          },
        },
      ]
    );
  }, [bumpDataVersion]);

  const renderSection = (title: string, children: React.ReactNode) => (
    <View style={styles.section}>
      <Text style={[Typography.labelSmall, styles.sectionTitle, { color: colors.textTertiary }]}>
        {title.toUpperCase()}
      </Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.bgCard }]}>
        {children}
      </View>
    </View>
  );

  const renderSetting = (
    label: string,
    description?: string,
    control?: React.ReactNode
  ) => (
    <View style={styles.settingRow}>
      <View style={styles.settingText}>
        <Text style={[Typography.titleSmall, { color: colors.textPrimary }]}>
          {label}
        </Text>
        {description && (
          <Text style={[Typography.bodySmall, { color: colors.textSecondary }]}>
            {description}
          </Text>
        )}
      </View>
      {control}
    </View>
  );

  const themeOptions: { mode: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'system', icon: <Monitor size={18} />, label: 'System' },
    { mode: 'dark', icon: <Moon size={18} />, label: 'Dark' },
    { mode: 'light', icon: <Sun size={18} />, label: 'Light' },
  ];

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bgPrimary }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
    >
      {renderSection('Appearance',
        <>
          <View style={styles.themeRow}>
            {themeOptions.map(({ mode, icon, label }) => (
              <Pressable
                key={mode}
                style={[
                  styles.themeButton,
                  { borderColor: themeMode === mode ? colors.brandPrimary : colors.borderLight },
                ]}
                onPress={() => setThemeMode(mode)}
              >
                {icon}
                <Text
                  style={[
                    Typography.labelMedium,
                    { color: themeMode === mode ? colors.brandPrimary : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {renderSetting(
            'Compact Mode',
            'Show more articles with smaller cards',
            <Switch
              value={compactMode}
              onValueChange={setCompactMode}
              trackColor={{ false: colors.borderMedium, true: colors.brandPrimary + '50' }}
              thumbColor={compactMode ? colors.brandPrimary : colors.textTertiary}
            />
          )}
        </>
      )}

      {renderSection('Reading',
        <>
          {renderSetting(
            'Auto-Mark as Read',
            'Mark articles as read when you scroll past them',
            <Switch
              value={autoMarkRead}
              onValueChange={setAutoMarkRead}
              trackColor={{ false: colors.borderMedium, true: colors.brandPrimary + '50' }}
              thumbColor={autoMarkRead ? colors.brandPrimary : colors.textTertiary}
            />
          )}
        </>
      )}

      {renderSection('Notifications',
        <>
          {renderSetting(
            'Breaking News Alerts',
            'Get notified for important stories (score 5)',
            <Switch
              value={notifyBreaking}
              onValueChange={setNotifyBreaking}
              trackColor={{ false: colors.borderMedium, true: colors.brandPrimary + '50' }}
              thumbColor={notifyBreaking ? colors.brandPrimary : colors.textTertiary}
            />
          )}
        </>
      )}

      {renderSection('Data & Storage',
        <>
          <View style={[styles.statsCard, { backgroundColor: colors.bgTertiary }]}>
            <View style={styles.statItem}>
              <Database size={20} color={colors.brandPrimary} />
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
                {storageStats.count} articles stored
              </Text>
            </View>
            {storageStats.oldestDate && (
              <Text style={[Typography.bodySmall, { color: colors.textTertiary }]}>
                Oldest: {formatDate(storageStats.oldestDate)} (auto-deletes after 7 days)
              </Text>
            )}
          </View>
          {renderSetting(
            'Clear Cache',
            'Remove all non-bookmarked articles',
            <Pressable onPress={handleClearCache} style={styles.iconButton}>
              <Trash2 size={22} color={colors.error} />
            </Pressable>
          )}
          {renderSetting(
            'Clear All Data',
            'Delete all stories and history',
            <Pressable onPress={handleClearAll} style={styles.iconButton}>
              <Trash2 size={22} color={colors.error} />
            </Pressable>
          )}
        </>
      )}

      {renderSection('About',
        <>
          <Pressable style={styles.linkRow}>
            <Shield size={20} color={colors.textSecondary} />
            <Text style={[Typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>
              Privacy Policy
            </Text>
            <ExternalLink size={18} color={colors.textTertiary} />
          </Pressable>
          <Pressable style={styles.linkRow}>
            <FileText size={20} color={colors.textSecondary} />
            <Text style={[Typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>
              Terms of Service
            </Text>
            <ExternalLink size={18} color={colors.textTertiary} />
          </Pressable>
          <View style={styles.linkRow}>
            <Info size={20} color={colors.textSecondary} />
            <Text style={[Typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>
              Version
            </Text>
            <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
              1.0.0
            </Text>
          </View>
        </>
      )}

      <View style={styles.footer}>
        <Text style={[Typography.bodySmall, { color: colors.textTertiary, textAlign: 'center' }]}>
          Tech Pulse - Daily tech news for developers
        </Text>
        <Text style={[Typography.labelSmall, { color: colors.textTertiary, marginTop: Spacing.xs }]}>
          Made with React Native & Expo
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  sectionContent: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  themeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  themeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  settingText: {
    flex: 1,
    marginRight: Spacing.md,
  },
  statsCard: {
    padding: Spacing.md,
    margin: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconButton: {
    padding: Spacing.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  footer: {
    marginTop: Spacing.xxl,
    alignItems: 'center',
  },
});