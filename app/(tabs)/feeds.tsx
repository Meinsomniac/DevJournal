import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { FEED_SOURCES, FEED_CATEGORIES } from '@/constants/Feeds';
import { FeedSource } from '@/types';
import { getEnabledFeeds, setFeedEnabled, getDisabledFeeds } from '@/services/db';
import { Header } from '@/components/common/Header';
import { SourceIcon } from '@/components/ui';

interface FeedRowProps {
  source: FeedSource;
  enabled: boolean;
  onToggle: (id: string, enabled: boolean) => void;
}

function FeedRow({ source, enabled, onToggle }: FeedRowProps) {
  const { colors } = useTheme();
  const categoryColor = colors[`cat${source.category}` as keyof typeof colors] || colors.brandPrimary;

  return (
    <TouchableOpacity
      style={[styles.feedRow, { backgroundColor: colors.bgCard }]}
      onPress={() => onToggle(source.id, !enabled)}
      activeOpacity={0.7}
    >
      <SourceIcon
        iconUri={source.icon}
        name={source.name}
        size={40}
        backgroundColor={categoryColor + '20'}
        color={categoryColor}
      />
      <View style={styles.feedInfo}>
        <Text style={[Typography.titleSmall, { color: colors.textPrimary }]}>
          {source.name}
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={(value) => onToggle(source.id, value)}
        trackColor={{ false: colors.borderMedium, true: colors.brandPrimary + '50' }}
        thumbColor={enabled ? colors.brandPrimary : colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

export default function FeedsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [enabledFeeds, setEnabledFeedsState] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadFeeds = async () => {
      try {
        const enabled = await getEnabledFeeds();
        const disabled = await getDisabledFeeds();
        // If no preferences set, enable all
        if (enabled.length === 0 && disabled.length === 0) {
          setEnabledFeedsState(new Set(FEED_SOURCES.map((s) => s.id)));
        } else {
          setEnabledFeedsState(new Set(enabled));
        }
      } catch (error) {
        console.error('Failed to load feeds:', error);
        setEnabledFeedsState(new Set(FEED_SOURCES.filter((s) => s.enabled).map((s) => s.id)));
      }
    };
    loadFeeds();
  }, []);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    setEnabledFeedsState((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(id);
      else next.delete(id);
      return next;
    });
    await setFeedEnabled(id, enabled);
  }, []);

  const groupedSources = FEED_CATEGORIES.map((category) => ({
    category: category.key,
    label: category.label,
    emoji: category.emoji,
    sources: FEED_SOURCES.filter((s) => s.category === category.key),
  })).filter((group) => group.sources.length > 0);

  const renderCategory = ({ item: group }: { item: typeof groupedSources[0] }) => (
    <View style={styles.categorySection}>
      <Text style={[Typography.headlineSmall, { color: colors.textPrimary }]}>
        {group.label}
      </Text>
      {group.sources.map((source) => (
        <FeedRow
          key={source.id}
          source={source}
          enabled={enabledFeeds.has(source.id)}
          onToggle={handleToggle}
        />
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title="Feeds"
        subtitle={`${FEED_SOURCES.length} sources available`}
      />
      <FlatList
        data={groupedSources}
        keyExtractor={(item) => item.category}
        renderItem={renderCategory}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: Spacing.lg,
  },
  categorySection: {
    marginBottom: Spacing.lg,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  feedInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
