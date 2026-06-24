import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { useApp } from '@/context/AppContext';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { CustomFeed } from '@/types';
import {
  getEnabledFeeds,
  setFeedEnabled,
  getDisabledFeeds,
  getCustomFeeds,
  removeCustomFeed,

} from '@/services/db';
import { Header } from '@/components/common/Header';
import { SourceIcon } from '@/components/ui';
import { AddFeedModal } from '@/components/feeds/AddFeedModal';
import { Plus, Trash2 } from 'lucide-react-native';

const fav = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

// ─── Built-in feeds (seeded into DB on first launch) ────────────────────────

const BUILTIN_FEEDS: CustomFeed[] = [
  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', rss_url: 'https://www.theverge.com/rss/index.xml', icon: fav('theverge.com'), added_at: 0 },
  { id: 'arstechnica', name: 'Ars Technica', url: 'https://arstechnica.com/feed/', rss_url: 'https://arstechnica.com/feed/', icon: fav('arstechnica.com'), added_at: 0 },
  { id: 'wired', name: 'Wired', url: 'https://www.wired.com/feed/rss', rss_url: 'https://www.wired.com/feed/rss', icon: fav('wired.com'), added_at: 0 },
  { id: 'venturebeat', name: 'VentureBeat', url: 'https://venturebeat.com/feed/', rss_url: 'https://venturebeat.com/feed/', icon: fav('venturebeat.com'), added_at: 0 },
  { id: 'techcrunch-dev', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', rss_url: 'https://techcrunch.com/feed/', icon: fav('techcrunch.com'), added_at: 0 },
  { id: 'hackernews', name: 'Hacker News', url: 'https://hnrss.org/frontpage', rss_url: 'https://hnrss.org/frontpage', icon: fav('news.ycombinator.com'), added_at: 0 },
  { id: 'devto', name: 'DEV Community', url: 'https://dev.to/feed', rss_url: 'https://dev.to/feed', icon: fav('dev.to'), added_at: 0 },
  { id: 'theregister', name: 'The Register', url: 'https://www.theregister.com/headlines.atom', rss_url: 'https://www.theregister.com/headlines.atom', icon: fav('theregister.com'), added_at: 0 },
];

const BUILTIN_IDS = new Set(BUILTIN_FEEDS.map(f => f.id));

// ─── Feed Row Component ─────────────────────────────────────────────────────

interface FeedRowProps {
  feed: CustomFeed;
  enabled: boolean;
  isCustom: boolean;
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string, name: string) => void;
}

const FeedRow = React.memo(function FeedRow({ feed, enabled, isCustom, onToggle, onDelete }: FeedRowProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.feedRow, { backgroundColor: colors.bgCard }]}
      onPress={() => onToggle(feed.id, !enabled)}
      activeOpacity={0.7}
    >
      <SourceIcon
        iconUri={feed.icon}
        name={feed.name}
        size={40}
        backgroundColor={colors.brandPrimary + '20'}
        color={colors.brandPrimary}
      />
      <View style={styles.feedInfo}>
        <Text style={[Typography.titleSmall, { color: colors.textPrimary }]}>
          {feed.name}
        </Text>
      </View>
      <Switch
        value={enabled}
        onValueChange={(value) => onToggle(feed.id, value)}
        trackColor={{ false: colors.borderMedium, true: colors.brandPrimary + '50' }}
        thumbColor={enabled ? colors.brandPrimary : colors.textTertiary}
      />
      {isCustom && (
        <TouchableOpacity
          onPress={() => onDelete(feed.id, feed.name)}
          style={styles.deleteButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={18} color={colors.error} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
});

// ─── Main Component ─────────────────────────────────────────────────────────

type SectionData =
  | { type: 'builtin-header' }
  | { type: 'custom-header'; count: number }
  | { type: 'feed'; feed: CustomFeed; isCustom: boolean };

export default function FeedsScreen() {
  const { colors } = useTheme();
  const { bumpDataVersion } = useApp();
  const insets = useSafeAreaInsets();
  const [enabledFeeds, setEnabledFeedsState] = useState<Set<string>>(new Set());
  const [customFeeds, setCustomFeeds] = useState<CustomFeed[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  const loadFeeds = useCallback(async () => {
    try {
      const enabled = await getEnabledFeeds();
      const disabled = await getDisabledFeeds();
      const customs = await getCustomFeeds();

      setEnabledFeedsState(new Set(enabled));

      setCustomFeeds(customs);
      bumpDataVersion();
    } catch (error) {
      console.error('Failed to load feeds:', error);
    }
  }, [bumpDataVersion]);

  React.useEffect(() => {
    const init = async () => { await loadFeeds(); };
    init();
  }, [loadFeeds]);

  const handleToggle = useCallback(async (id: string, enabled: boolean) => {
    setEnabledFeedsState((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(id);
      else next.delete(id);
      return next;
    });
    await setFeedEnabled(id, enabled);
    bumpDataVersion();
  }, [bumpDataVersion]);

  const builtinFeeds = BUILTIN_FEEDS;
  const customOnlyFeeds = customFeeds.filter(f => !BUILTIN_IDS.has(f.id));

  const handleToggleAll = useCallback(async (enable: boolean) => {
    const allFeeds = [...BUILTIN_FEEDS, ...customOnlyFeeds];
    for (const feed of allFeeds) {
      await setFeedEnabled(feed.id, enable);
    }
    setEnabledFeedsState(new Set(enable ? allFeeds.map(f => f.id) : []));
    bumpDataVersion();
  }, [bumpDataVersion, customOnlyFeeds]);

  const handleDelete = useCallback((id: string, name: string) => {
    Alert.alert(
      'Remove Feed',
      `Remove "${name}" from your feeds?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeCustomFeed(id);
            await loadFeeds();
          },
        },
      ]
    );
  }, [loadFeeds]);

  const sections: SectionData[] = [];
  builtinFeeds.forEach(f => sections.push({ type: 'feed', feed: f, isCustom: false }));
  if (customOnlyFeeds.length > 0) {
    sections.push({ type: 'custom-header', count: customOnlyFeeds.length });
    customOnlyFeeds.forEach(f => sections.push({ type: 'feed', feed: f, isCustom: true }));
  }

  const renderItem = useCallback(({ item }: { item: SectionData }) => {
    if (item.type === 'builtin-header') return null;
    if (item.type === 'custom-header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={[Typography.headlineSmall, { color: colors.textPrimary }]}>
            Your Custom Feeds
          </Text>
          <Text style={[Typography.labelMedium, { color: colors.textTertiary }]}>
            {item.count} added
          </Text>
        </View>
      );
    }

    const { feed, isCustom } = item;

    return (
      <FeedRow
        feed={feed}
        enabled={enabledFeeds.has(feed.id)}
        isCustom={isCustom}
        onToggle={handleToggle}
        onDelete={handleDelete}
      />
    );
  }, [colors, enabledFeeds, handleToggle, handleDelete]);

  const keyExtractor = useCallback((item: SectionData) => {
    if (item.type === 'builtin-header') return '__builtin__';
    if (item.type === 'custom-header') return '__custom__';
    return item.feed.id;
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title="Feeds"
        subtitle={`${builtinFeeds.length + customOnlyFeeds.length} sources available`}
        rightContent={
          <TouchableOpacity
            onPress={() => setShowAddModal(true)}
            style={[styles.addButton, { backgroundColor: colors.brandPrimary + '15' }]}
          >
            <Plus size={20} color={colors.brandPrimary} />
          </TouchableOpacity>
        }
      />

      <View style={[styles.disableAllRow, { borderColor: colors.borderLight }]}>
        <View>
          <Text style={[Typography.titleMedium, { color: colors.textPrimary }]}>
            All Sources
          </Text>
          <Text style={[Typography.labelSmall, { color: colors.textTertiary }]}>
            {enabledFeeds.size} of {builtinFeeds.length + customOnlyFeeds.length} enabled
          </Text>
        </View>
        <Switch
          value={enabledFeeds.size === builtinFeeds.length + customOnlyFeeds.length}
          onValueChange={handleToggleAll}
          trackColor={{ false: colors.borderMedium, true: colors.brandPrimary + '50' }}
          thumbColor={enabledFeeds.size === builtinFeeds.length + customOnlyFeeds.length ? colors.brandPrimary : colors.textTertiary}
        />
      </View>

      <FlashList
        data={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      />

      <AddFeedModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onFeedAdded={loadFeeds}
        existingFeedUrls={new Set(customFeeds.map(f => f.rss_url))}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  addButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  sectionLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.sm,
  },
  listContent: {
    paddingTop: Spacing.sm,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  disableAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  feedInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  deleteButton: {
    padding: Spacing.sm,
  },
});
