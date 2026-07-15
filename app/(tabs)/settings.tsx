import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Linking,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp, ListMode } from '@/context/AppContext';
import { useHaptics } from '@/hooks/useHaptics';
import { toast } from 'sonner-native';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { clearAllData, getStorageStats, StorageStats } from '@/services/db';
import { formatDate } from '@/utils/date';
import { Header } from '@/components/common/Header';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
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
    listMode,
    setListMode,
    autoMarkRead,
    setAutoMarkRead,
    notifyBreaking,
    setNotifyBreaking,
    bumpDataVersion,
  } = useApp();

  const { hapticLight, hapticHeavy, hapticSuccess } = useHaptics();
  const insets = useSafeAreaInsets();

  const [storageStats, setStorageStats] = useState<StorageStats>({ count: 0, oldestDate: null, storageMb: 0 });
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const stats = await getStorageStats();
      setStorageStats(stats);
    } catch (error) {
      console.error('Failed to load storage stats:', error);
    }
  }, []);

  // Reload stats every time the tab is focused, since article fetches (and
  // clearing data) happen elsewhere and tab screens stay mounted.
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const handleClearAll = useCallback(() => {
    hapticHeavy();
    setShowClearConfirm(true);
  }, [hapticHeavy]);

  const handleConfirmClearAll = useCallback(async () => {
    setShowClearConfirm(false);
    try {
      await clearAllData();
      const stats = await getStorageStats();
      setStorageStats(stats);
      bumpDataVersion();
      toast.success('All data cleared');
      hapticSuccess();
    } catch (error) {
      console.error('Failed to clear all data:', error);
      toast.error('Failed to clear data');
    }
  }, [bumpDataVersion, hapticSuccess]);

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

  const themeOptions: { mode: ThemeMode; renderIcon: (color: string) => React.ReactNode; label: string }[] = [
    { mode: 'system', renderIcon: (c: string) => <Monitor size={18} color={c} />, label: 'System' },
    { mode: 'dark', renderIcon: (c: string) => <Moon size={18} color={c} />, label: 'Dark' },
    { mode: 'light', renderIcon: (c: string) => <Sun size={18} color={c} />, label: 'Light' },
  ];

  const listModeOptions: { mode: ListMode; label: string }[] = [
    { mode: 'flat', label: 'Flat' },
    { mode: 'card', label: 'Card' },
    { mode: 'compact', label: 'Compact' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Settings" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xxl }]}
      >
      {renderSection('Appearance',
        <>
          <View style={styles.themeRow}>
            {themeOptions.map(({ mode, renderIcon, label }) => (
              <Pressable
                key={mode}
                style={[
                  styles.themeButton,
                  { borderColor: themeMode === mode ? colors.brandPrimary : colors.borderLight },
                ]}
                onPress={() => setThemeMode(mode)}
              >
                {renderIcon(themeMode === mode ? colors.brandPrimary : colors.textSecondary)}
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
          <View style={styles.listModeRow}>
            {listModeOptions.map(({ mode, label }) => (
              <Pressable
                key={mode}
                style={[
                  styles.listModeButton,
                  {
                    borderColor: listMode === mode ? colors.brandPrimary : colors.borderLight,
                    backgroundColor: listMode === mode ? colors.brandPrimary + '20' : 'transparent',
                  },
                ]}
                onPress={() => { hapticLight(); setListMode(mode); }}
              >
                <Text
                  style={[
                    Typography.labelMedium,
                    { color: listMode === mode ? colors.brandPrimary : colors.textSecondary },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {renderSetting(
            'Article Layout',
            'Flat is a minimal list, Card shows full images, Compact is dense.',
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
              onValueChange={(value) => { hapticLight(); setAutoMarkRead(value); }}
              trackColor={{ false: colors.borderMedium, true: colors.brandPrimary + '50' }}
              thumbColor={autoMarkRead ? colors.brandPrimary : colors.textTertiary}
            />
          )}
        </>
      )}

      {renderSection('Notifications',
        <>
          {renderSetting(
            'Important News Alerts',
            'Notify you of high-importance stories from your feeds.',
            <Switch
              value={notifyBreaking}
              onValueChange={(value) => { hapticLight(); setNotifyBreaking(value); }}
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
            <View style={styles.statItem}>
              <Database size={20} color={colors.brandPrimary} />
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
                {storageStats.storageMb} MB used
              </Text>
            </View>
            {storageStats.oldestDate && (
              <Text style={[Typography.bodySmall, { color: colors.textTertiary }]}>
                Oldest: {formatDate(storageStats.oldestDate)} (auto-deletes after 7 days)
              </Text>
            )}
          </View>
          {renderSetting(
            'Clear All Data',
            'Delete all articles and bookmarks',
            <Pressable onPress={handleClearAll} style={styles.iconButton}>
              <Trash2 size={22} color={colors.error} />
            </Pressable>
          )}
        </>
      )}

      {renderSection('About',
        <>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://meinsomniac.github.io/devjournal-pages/privacy.html')}>
            <Shield size={20} color={colors.textSecondary} />
            <Text style={[Typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]}>
              Privacy Policy
            </Text>
            <ExternalLink size={18} color={colors.textTertiary} />
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => Linking.openURL('https://meinsomniac.github.io/devjournal-pages/terms.html')}>
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
          DevJournal - Daily tech news for developers
        </Text>
      </View>
    </ScrollView>

      <ConfirmModal
        visible={showClearConfirm}
        title="Clear All Data"
        message="This will delete all articles and bookmarks. Settings, feed sources, and preferences will be preserved. This cannot be undone."
        confirmLabel="Delete All"
        cancelLabel="Cancel"
        destructive
        onConfirm={handleConfirmClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />
    </View>
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
  listModeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  listModeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
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