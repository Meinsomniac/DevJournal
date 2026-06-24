import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Animated,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import { Article, FeedSource, FilterState, DEFAULT_FILTER } from '@/types';
import { getDigestFeed, toggleBookmark, saveArticles, getFilteredArticles, getEnabledFeedSources, getNotifiedArticleIds, markArticlesNotified, getArticleCount, markRead, getSetting, setSetting } from '@/services/db';
import { fetchAllFeeds } from '@/services/rssParser';
import { deduplicateByLink } from '@/services/ranking';
import { sendBreakingNotificationBatch } from '@/services/notifications';
import { SearchBar } from '@/components/common';
import { DigestCard, FilterModal } from '@/components/digest';
import { ArticleSkeleton, EmptyState, Button } from '@/components/ui';
import { Newspaper, RefreshCw, ArrowUp } from 'lucide-react-native';

export default function DigestScreen() {
  const { colors, compactMode, dataVersion, notifyBreaking, autoMarkRead } = useApp();
  const insets = useSafeAreaInsets();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [enabledSources, setEnabledSources] = useState<FeedSource[]>([]);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);
  const listRef = useRef<any>(null);
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const fetchNewsRef = useRef<() => Promise<void>>(async () => {});
  const markedReadRef = useRef<Set<string>>(new Set());

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
  }), []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { item: Article }[] }) => {
    if (!autoMarkRead) return;
    viewableItems.forEach(({ item }) => {
      if (!markedReadRef.current.has(item.id)) {
        markedReadRef.current.add(item.id);
        markRead(item.id);
      }
    });
  }, [autoMarkRead]);

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

  const fetchNews = useCallback(async (skipCache: boolean = false) => {
    if (fetching) return;
    setHasMore(true);
    setFetching(true);
    try {
      const rawArticles = await fetchAllFeeds(skipCache);
      const unique = deduplicateByLink(rawArticles);

      const notifiedIds = await getNotifiedArticleIds();
      const breaking = notifyBreaking
        ? unique.filter(a => a.importance_score === 5 && !notifiedIds.has(a.id))
        : [];

      const saved = await saveArticles(unique);
      console.log(`Saved ${saved} new articles`);

      if (breaking.length > 0) {
        await sendBreakingNotificationBatch(
          breaking.map(a => ({ title: a.title, sourceName: a.source_name, id: a.id }))
        );
        await markArticlesNotified(breaking.map(a => a.id));
      }

      await loadData(searchQuery);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setFetching(false);
    }
  }, [fetching, loadData, searchQuery, notifyBreaking]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNews(false); // Don't bypass cache on pull to refresh
    setRefreshing(false);
  }, [fetchNews]);

  useEffect(() => {
    fetchNewsRef.current = fetchNews;
  }, [fetchNews]);

  useEffect(() => {
    const init = async () => {
      await loadData(searchQuery);
      const [count, initialFetchDone] = await Promise.all([
        getArticleCount(),
        getSetting<boolean>('initialFetchDone', false),
      ]);
      if (count === 0 && !initialFetchDone) {
        await fetchNewsRef.current(false); // Use cache on initial fetch
        await setSetting('initialFetchDone', true);
      }
    };
    const id = setTimeout(init, 0);
    getEnabledFeedSources().then(setEnabledSources);
    return () => clearTimeout(id);
  }, [dataVersion, loadData, searchQuery]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Auto-fetch on app foreground and every 5 minutes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        fetchNews(true); // Bypass cache on foreground
      }
      appState.current = nextState;
    });

    const interval = setInterval(() => fetchNews(true), 5 * 60 * 1000); // Bypass cache on periodic fetch

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
    getEnabledFeedSources().then(setEnabledSources);
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

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        setShowScrollTop(offsetY > 600);
      },
    }
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
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
        <View style={[styles.content, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.xxl }]}>
          {[1, 2, 3].map((i) => (
            <ArticleSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  const isEmpty = articles.length === 0 && !searching && !loading;

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary, paddingTop: insets.top + Spacing.lg }]}>
      <View style={{ marginBottom: Spacing.md }}>
        <SearchBar
          value={searchQuery}
          onChangeText={handleSearchTextChange}
          onSubmitEditing={handleSearchSubmit}
          onFilterPress={handleOpenFilter}
          filterActive={isFilterActive}
          placeholder="Search articles..."
        />
      </View>

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
        <View style={{ flex: 1 }}>
          <FlashList
            ref={listRef}
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
            onScroll={handleScroll}
            scrollEventThrottle={16}
            viewabilityConfig={viewabilityConfig}
            onViewableItemsChanged={onViewableItemsChanged}
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
          {showScrollTop && (
            <Pressable
              onPress={scrollToTop}
              style={[
                styles.fab,
                {
                  backgroundColor: colors.brandPrimary,
                  bottom: insets.bottom + Spacing.xxl,
                },
              ]}
            >
              <ArrowUp size={24} color={colors.textInverse} />
            </Pressable>
          )}
        </View>
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
  fab: {
    position: 'absolute',
    right: Spacing.lg,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});