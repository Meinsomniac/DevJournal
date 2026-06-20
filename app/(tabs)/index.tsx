import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { Spacing } from '@/constants/Spacing';
import { Article } from '@/types';
import { getDigestFeed, toggleBookmark, getUnreadCount, saveArticles } from '@/services/db';
import { fetchAllFeeds } from '@/services/rssParser';
import { deduplicateByLink } from '@/services/ranking';
import { Header } from '@/components/common/Header';
import { DigestCard } from '@/components/digest/DigestCard';
import { SectionHeader } from '@/components/digest/SectionHeader';
import { ArticleSkeleton, EmptyState, Button } from '@/components/ui';
import { Newspaper, RefreshCw } from 'lucide-react-native';

export default function DigestScreen() {
  const { colors, compactMode, dataVersion } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const loadedRef = React.useRef(false);

  const loadData = useCallback(async () => {
    try {
      const feed = await getDigestFeed(50);
      setArticles(feed);
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
    }
    const init = async () => { await loadData(); };
    init();
  }, [loadData, dataVersion]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const fetchNews = useCallback(async () => {
    if (fetching) return;
    setFetching(true);
    try {
      const rawArticles = await fetchAllFeeds();
      const unique = deduplicateByLink(rawArticles);
      const saved = await saveArticles(unique);
      console.log(`Saved ${saved} new articles`);
      await loadData();
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setFetching(false);
    }
  }, [fetching, loadData]);

  const handleBookmark = useCallback(async (id: string) => {
    await toggleBookmark(id);
    await loadData();
  }, [loadData]);

  const handleSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  const { breaking, regular, displayArticles } = React.useMemo(() => {
    const b = articles.filter((a) => a.importance_score === 5);
    const r = articles.filter((a) => a.importance_score < 5);
    return {
      breaking: b,
      regular: r,
      displayArticles: b.length > 0 && r.length > 0 ? [b[0], ...r] : articles,
    };
  }, [articles]);

  const renderArticle = useCallback(({ item }: { item: Article }) => (
    <DigestCard
      article={item}
      variant={compactMode ? 'compact' : item.importance_score >= 4 ? 'full' : 'compact'}
      onBookmark={handleBookmark}
    />
  ), [compactMode, handleBookmark]);

  const renderItem = useCallback(({ item, index }: { item: Article; index: number }) => {
    if (index === 0 && breaking.length > 0) {
      return (
        <View>
          <SectionHeader title="Breaking" breaking count={breaking.length} />
          {breaking.map((article) => (
            <DigestCard
              key={article.id}
              article={article}
              variant="full"
              onBookmark={handleBookmark}
            />
          ))}
          {regular.length > 0 && (
            <SectionHeader title="Latest Stories" count={regular.length} />
          )}
        </View>
      );
    }

    return renderArticle({ item });
  }, [breaking, regular, renderArticle, handleBookmark]);

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Header title="Tech Pulse" showSettings onSettingsPress={handleSettings} />
        <View style={styles.content}>
          {[1, 2, 3].map((i) => (
            <ArticleSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  if (articles.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Header title="Tech Pulse" showSettings onSettingsPress={handleSettings} />
        <EmptyState
          icon={Newspaper}
          title="No news yet"
          description="Pull to refresh or tap to fetch the latest stories from your feeds."
          action={
            <Button
              title={fetching ? 'Fetching...' : 'Fetch News'}
              onPress={fetchNews}
              loading={fetching}
              icon={<RefreshCw size={16} color={colors.textInverse} />}
            />
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title="Tech Pulse"
        subtitle={`${dateStr} · ${articles.length} stories${unreadCount > 0 ? ` · ${unreadCount} unread` : ''}`}
        showSettings
        onSettingsPress={handleSettings}
        rightContent={
          fetching ? (
            <ActivityIndicator size="small" color={colors.brandPrimary} />
          ) : undefined
        }
      />

      <FlashList
        data={displayArticles}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + Spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brandPrimary}
            colors={[colors.brandPrimary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  listContent: {
    padding: Spacing.lg,
  },
});
