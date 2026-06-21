import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import { Article, FeedSource, FilterState, DEFAULT_FILTER } from '@/types';
import { getDigestFeed, toggleBookmark, getUnreadCount, saveArticles, getFilteredArticles, getEnabledFeedSources } from '@/services/db';
import { fetchAllFeeds } from '@/services/rssParser';
import { deduplicateByLink } from '@/services/ranking';
import { sendBreakingNotificationBatch } from '@/services/notifications';
import { SearchBar } from '@/components/common';
import { DigestCard, FilterModal } from '@/components/digest';
import { ArticleSkeleton, EmptyState, Button } from '@/components/ui';
import { Newspaper, RefreshCw } from 'lucide-react-native';

export default function DigestScreen() {
  const { colors, compactMode, dataVersion, notifyBreaking } = useApp();
  const insets = useSafeAreaInsets();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [enabledSources, setEnabledSources] = useState<FeedSource[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);
  const articleIdsBeforeFetch = useRef<Set<string> | null>(null);

  const PAGE_SIZE = 50;

  const isFilterActive =
    filters.sourceNames.length > 0 ||
    filters.minRating > 0 ||
    filters.datePreset !== null;

  const loadData = useCallback(async (searchText: string, loadOffset = 0) => {
    try {
      const hasFilters = filters.sourceNames.length > 0 || filters.minRating > 0 || filters.datePreset !== null;
      if (hasFilters || searchText.trim()) {
        if (loadOffset === 0) setSearching(true);
        const results = await getFilteredArticles(filters, searchText.trim() || undefined, PAGE_SIZE, loadOffset);
        if (loadOffset === 0) setArticles(results);
        else setArticles(prev => [...prev, ...results]);
        if (results.length < PAGE_SIZE) setHasMore(false);
      } else {
        const feed = await getDigestFeed(PAGE_SIZE, loadOffset, filters.sortOrder);
        if (loadOffset === 0) setArticles(feed);
        else setArticles(prev => [...prev, ...feed]);
        if (feed.length < PAGE_SIZE) setHasMore(false);
      }
      if (loadOffset === 0) {
        const count = await getUnreadCount();
        setUnreadCount(count);
      }
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setLoading(false);
      setSearching(false);
      setLoadingMore(false);
    }
  }, [filters]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    loadData(searchQuery, articles.length);
  }, [loadingMore, hasMore, loadData, searchQuery, articles.length]);

  useEffect(() => {
    setHasMore(true);
    loadData(searchQuery);
    getEnabledFeedSources().then(setEnabledSources);
  }, [dataVersion, loadData]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchNews = useCallback(async () => {
    if (fetching) return;
    articleIdsBeforeFetch.current = new Set(articles.map(a => a.id));
    setHasMore(true);
    setFetching(true);
    try {
      const rawArticles = await fetchAllFeeds();
      const unique = deduplicateByLink(rawArticles);

      const breaking = notifyBreaking
        ? unique.filter(a => a.importance_score === 5 && !articleIdsBeforeFetch.current?.has(a.id))
        : [];

      const saved = await saveArticles(unique);
      console.log(`Saved ${saved} new articles`);

      if (breaking.length > 0) {
        await sendBreakingNotificationBatch(
          breaking.map(a => ({ title: a.title, sourceName: a.source_name, id: a.id }))
        );
      }

      await loadData(searchQuery);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setFetching(false);
    }
  }, [fetching, loadData, searchQuery, notifyBreaking, articles]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNews();
    setRefreshing(false);
  }, [fetchNews]);

  // Auto-fetch on app foreground and every 5 minutes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        fetchNews();
      }
      appState.current = nextState;
    });

    const interval = setInterval(fetchNews, 5 * 60 * 1000);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [fetchNews]);

  const handleSearchTextChange = useCallback((text: string) => {
    setSearchQuery(text);
    setHasMore(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadData(text);
    }, 300);
  }, [loadData]);

  const handleSearchSubmit = useCallback((text: string) => {
    setHasMore(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    loadData(text);
  }, [loadData]);

  const handleBookmark = useCallback(async (id: string) => {
    await toggleBookmark(id);
    await loadData(searchQuery);
  }, [loadData, searchQuery]);

  const handleOpenFilter = useCallback(() => {
    setShowFilterModal(true);
  }, []);

  const handleApplyFilter = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setShowFilterModal(false);
  }, []);

  const handleClearFilter = useCallback(() => {
    setFilters(DEFAULT_FILTER);
    setShowFilterModal(false);
  }, []);

  const renderArticle = useCallback(({ item }: { item: Article }) => (
    <DigestCard
      article={item}
      variant={compactMode ? 'compact' : 'full'}
      onBookmark={handleBookmark}
    />
  ), [compactMode, handleBookmark]);

  if (loading && articles.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <View style={[styles.content, { paddingTop: insets.top }]}>
          {[1, 2, 3].map((i) => (
            <ArticleSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  const isEmpty = articles.length === 0 && !searching && !loading;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary, paddingTop: insets.top + Spacing.sm }]}>
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearchTextChange}
        onSubmitEditing={handleSearchSubmit}
        onFilterPress={handleOpenFilter}
        filterActive={isFilterActive}
        placeholder="Search articles..."
      />

      <FilterModal
        visible={showFilterModal}
        filters={filters}
        onApply={handleApplyFilter}
        onClear={handleClearFilter}
        onClose={() => setShowFilterModal(false)}
        sources={enabledSources}
      />

      {searching && (
        <View style={styles.searchingIndicator}>
          <ActivityIndicator size="small" color={colors.brandPrimary} />
        </View>
      )}

      {isEmpty ? (
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
      ) : (
        <FlashList
          data={articles}
          keyExtractor={(item) => item.id}
          renderItem={renderArticle}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.brandPrimary} />
                <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginLeft: Spacing.sm }]}>
                  Loading more...
                </Text>
              </View>
            ) : !hasMore && articles.length > 0 ? (
              <View style={styles.footerLoader}>
                <Text style={[Typography.bodySmall, { color: colors.textTertiary }]}>
                  All articles loaded
                </Text>
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brandPrimary}
              colors={[colors.brandPrimary]}
            />
          }
        />
      )}
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  searchingIndicator: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
  },
});