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
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { CustomFeed } from '@/types';
import {
  getEnabledFeeds,
  setFeedEnabled,
  getDisabledFeeds,
  getCustomFeeds,
  removeCustomFeed,
  seedCustomFeedsIfNeeded,
} from '@/services/db';
import { Header } from '@/components/common/Header';
import { SourceIcon } from '@/components/ui';
// TODO: Re-enable when feed discovery is fixed
// import { AddFeedModal } from '@/components/feeds/AddFeedModal';
import { Trash2 } from 'lucide-react-native';
// TODO: Re-enable when feed discovery is fixed
// import { Plus, Trash2 } from 'lucide-react-native';

const fav = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

// ─── Built-in feeds (seeded into DB on first launch) ────────────────────────

const BUILTIN_FEEDS: CustomFeed[] = [
  { id: 'openai', name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', rss_url: 'https://openai.com/blog/rss.xml', category: 'AI', icon: fav('openai.com'), added_at: 0 },
  { id: 'anthropic', name: 'Anthropic', url: 'https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml', rss_url: 'https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml', category: 'AI', icon: fav('anthropic.com'), added_at: 0 },
  { id: 'huggingface', name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', rss_url: 'https://huggingface.co/blog/feed.xml', category: 'AI', icon: fav('huggingface.co'), added_at: 0 },
  { id: 'google-ai', name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/', rss_url: 'https://blog.google/technology/ai/rss/', category: 'AI', icon: fav('blog.google'), added_at: 0 },
  { id: 'martin-fowler', name: 'Martin Fowler', url: 'https://martinfowler.com/feed.atom', rss_url: 'https://martinfowler.com/feed.atom', category: 'AI', icon: fav('martinfowler.com'), added_at: 0 },
  { id: 'react-native', name: 'React Native Blog', url: 'https://reactnative.dev/blog/feed.xml', rss_url: 'https://reactnative.dev/blog/feed.xml', category: 'Frontend', icon: fav('reactnative.dev'), added_at: 0 },
  { id: 'expo', name: 'Expo Blog', url: 'https://blog.expo.dev/feed', rss_url: 'https://blog.expo.dev/feed', category: 'Frontend', icon: fav('expo.dev'), added_at: 0 },
  { id: 'react', name: 'React Blog', url: 'https://react.dev/rss.xml', rss_url: 'https://react.dev/rss.xml', category: 'Frontend', icon: fav('react.dev'), added_at: 0 },
  { id: 'vercel', name: 'Vercel Blog', url: 'https://vercel.com/atom', rss_url: 'https://vercel.com/atom', category: 'Frontend', icon: fav('vercel.com'), added_at: 0 },
  { id: 'nextjs', name: 'Next.js Blog', url: 'https://nextjs.org/feed.xml', rss_url: 'https://nextjs.org/feed.xml', category: 'Frontend', icon: fav('nextjs.org'), added_at: 0 },
  { id: 'css-tricks', name: 'CSS-Tricks', url: 'https://css-tricks.com/feed/', rss_url: 'https://css-tricks.com/feed/', category: 'Frontend', icon: fav('css-tricks.com'), added_at: 0 },
  { id: 'smashing', name: 'Smashing Magazine', url: 'https://www.smashingmagazine.com/feed/', rss_url: 'https://www.smashingmagazine.com/feed/', category: 'Frontend', icon: fav('smashingmagazine.com'), added_at: 0 },
  { id: 'github', name: 'GitHub Blog', url: 'https://github.blog/feed/', rss_url: 'https://github.blog/feed/', category: 'Tools', icon: fav('github.com'), added_at: 0 },
  { id: 'typescript', name: 'TypeScript', url: 'https://devblogs.microsoft.com/typescript/feed/', rss_url: 'https://devblogs.microsoft.com/typescript/feed/', category: 'Tools', icon: fav('devblogs.microsoft.com'), added_at: 0 },
  { id: 'stripe', name: 'Stripe Blog', url: 'https://stripe.com/blog/feed.rss', rss_url: 'https://stripe.com/blog/feed.rss', category: 'Tools', icon: fav('stripe.com'), added_at: 0 },
  { id: 'nodejs', name: 'Node.js Blog', url: 'https://nodejs.org/en/feed/blog.xml', rss_url: 'https://nodejs.org/en/feed/blog.xml', category: 'Backend', icon: fav('nodejs.org'), added_at: 0 },
  { id: 'meta-eng', name: 'Engineering at Meta', url: 'https://engineering.fb.com/feed/', rss_url: 'https://engineering.fb.com/feed/', category: 'Backend', icon: fav('engineering.fb.com'), added_at: 0 },
  { id: 'infoq', name: 'InfoQ', url: 'https://www.infoq.com/feed/', rss_url: 'https://www.infoq.com/feed/', category: 'Backend', icon: fav('infoq.com'), added_at: 0 },
  { id: 'kubernetes', name: 'Kubernetes Blog', url: 'https://kubernetes.io/feed.xml', rss_url: 'https://kubernetes.io/feed.xml', category: 'Infrastructure', icon: fav('kubernetes.io'), added_at: 0 },
  { id: 'aws', name: 'AWS News', url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/', rss_url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/', category: 'Infrastructure', icon: fav('aws.amazon.com'), added_at: 0 },
  { id: 'cloudflare', name: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/', rss_url: 'https://blog.cloudflare.com/rss/', category: 'Infrastructure', icon: fav('cloudflare.com'), added_at: 0 },
  { id: 'theverge', name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', rss_url: 'https://www.theverge.com/rss/index.xml', category: 'General', icon: fav('theverge.com'), added_at: 0 },
  { id: 'arstechnica', name: 'Ars Technica', url: 'https://arstechnica.com/feed/', rss_url: 'https://arstechnica.com/feed/', category: 'General', icon: fav('arstechnica.com'), added_at: 0 },
  { id: 'wired', name: 'Wired', url: 'https://www.wired.com/feed/rss', rss_url: 'https://www.wired.com/feed/rss', category: 'General', icon: fav('wired.com'), added_at: 0 },
  { id: 'venturebeat', name: 'VentureBeat', url: 'https://venturebeat.com/feed/', rss_url: 'https://venturebeat.com/feed/', category: 'General', icon: fav('venturebeat.com'), added_at: 0 },
  { id: 'techcrunch-dev', name: 'TechCrunch', url: 'https://techcrunch.com/feed/', rss_url: 'https://techcrunch.com/feed/', category: 'General', icon: fav('techcrunch.com'), added_at: 0 },
  { id: 'hackernews', name: 'Hacker News', url: 'https://hnrss.org/frontpage', rss_url: 'https://hnrss.org/frontpage', category: 'General', icon: fav('news.ycombinator.com'), added_at: 0 },
  { id: 'devto', name: 'DEV Community', url: 'https://dev.to/feed', rss_url: 'https://dev.to/feed', category: 'General', icon: fav('dev.to'), added_at: 0 },
  { id: 'theregister', name: 'The Register', url: 'https://www.theregister.com/headlines.atom', rss_url: 'https://www.theregister.com/headlines.atom', category: 'General', icon: fav('theregister.com'), added_at: 0 },
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
  const categoryColor = colors[`cat${feed.category}` as keyof typeof colors] || colors.brandPrimary;

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
        backgroundColor={categoryColor + '20'}
        color={categoryColor}
      />
      <View style={styles.feedInfo}>
        <Text style={[Typography.titleSmall, { color: colors.textPrimary }]}>
          {feed.name}
        </Text>
        <Text style={[Typography.labelSmall, { color: colors.textTertiary }]}>
          {feed.category}
        </Text>
      </View>
      {isCustom ? (
        <TouchableOpacity
          onPress={() => onDelete(feed.id, feed.name)}
          style={styles.deleteButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Trash2 size={18} color={colors.error} />
        </TouchableOpacity>
      ) : (
        <Switch
          value={enabled}
          onValueChange={(value) => onToggle(feed.id, value)}
          trackColor={{ false: colors.borderMedium, true: colors.brandPrimary + '50' }}
          thumbColor={enabled ? colors.brandPrimary : colors.textTertiary}
        />
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
  const insets = useSafeAreaInsets();
  const [enabledFeeds, setEnabledFeedsState] = useState<Set<string>>(new Set());
  const [customFeeds, setCustomFeeds] = useState<CustomFeed[]>([]);
  // TODO: Re-enable when feed discovery is fixed
  // const [showAddModal, setShowAddModal] = useState(false);

  const loadFeeds = useCallback(async () => {
    try {
      await seedCustomFeedsIfNeeded();
      const enabled = await getEnabledFeeds();
      const disabled = await getDisabledFeeds();
      const customs = await getCustomFeeds();

      if (enabled.length === 0 && disabled.length === 0) {
        setEnabledFeedsState(new Set(BUILTIN_FEEDS.map((s) => s.id)));
      } else {
        setEnabledFeedsState(new Set(enabled));
      }

      setCustomFeeds(customs);
    } catch (error) {
      console.error('Failed to load feeds:', error);
    }
  }, []);

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
  }, []);

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

  const builtinFeeds = BUILTIN_FEEDS;
  // TODO: Re-enable when feed discovery is fixed
  // const customOnlyFeeds = customFeeds.filter(f => !BUILTIN_IDS.has(f.id));

  const sections: SectionData[] = [];
  builtinFeeds.forEach(f => sections.push({ type: 'feed', feed: f, isCustom: false }));
  // TODO: Re-enable when feed discovery is fixed
  // if (customOnlyFeeds.length > 0) {
  //   sections.push({ type: 'custom-header', count: customOnlyFeeds.length });
  //   customOnlyFeeds.forEach(f => sections.push({ type: 'feed', feed: f, isCustom: true }));
  // }

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
        // TODO: Re-enable when feed discovery is fixed
        // isCustom={isCustom}
        isCustom={false}
        onToggle={handleToggle}
        // TODO: Re-enable when feed discovery is fixed
        // onDelete={handleDelete}
        onDelete={() => {}}
      />
    );
  }, [colors, enabledFeeds, handleToggle, handleDelete]);

  const keyExtractor = useCallback((item: SectionData) => {
    if (item.type === 'builtin-header') return '__builtin__';
    // TODO: Re-enable when feed discovery is fixed
    // if (item.type === 'custom-header') return '__custom__';
    if (item.type === 'custom-header') return '__custom__';
    return item.feed.id;
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title="Feeds"
        // TODO: Re-enable when feed discovery is fixed
        // subtitle={`${builtinFeeds.length + customOnlyFeeds.length} sources available`}
        subtitle={`${builtinFeeds.length} sources available`}
        // TODO: Re-enable when feed discovery is fixed
        // rightContent={
        //   <TouchableOpacity
        //     onPress={() => setShowAddModal(true)}
        //     style={[styles.addButton, { backgroundColor: colors.brandPrimary + '15' }]}
        //   >
        //     <Plus size={20} color={colors.brandPrimary} />
        //   </TouchableOpacity>
        // }
      />

      <View style={styles.sectionLabel}>
        <Text style={[Typography.headlineSmall, { color: colors.textPrimary }]}>
          Built-in Sources
        </Text>
        <Text style={[Typography.labelMedium, { color: colors.textTertiary }]}>
          {builtinFeeds.length}
        </Text>
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

      {/*
      // TODO: Re-enable when feed discovery is fixed
      <AddFeedModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onFeedAdded={loadFeeds}
        existingFeedUrls={new Set(customFeeds.map(f => f.rss_url))}
      />
      */}
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
  feedInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  deleteButton: {
    padding: Spacing.sm,
  },
});
