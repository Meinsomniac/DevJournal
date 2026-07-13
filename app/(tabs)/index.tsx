import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, ActivityIndicator,
  AppState, AppStateStatus, Animated, Pressable,
  InteractionManager,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useApp } from '@/context/AppContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Spacing } from '@/constants/Spacing';
import { Typography } from '@/constants/Typography';
import { Article, FeedSource, FilterState, DEFAULT_FILTER } from '@/types';
import { getDigestFeed, toggleBookmark, saveArticles, getFilteredArticles, getEnabledFeedSources, getNotifiedArticleIds, markArticlesNotified, getArticleCount, markRead, getSetting, setSetting, pruneOldArticles, updateArticleNsfwStatus } from '@/services/db';
import { fetchAllFeeds } from '@/services/rssParser';
import { classifyImage, isNSFWReady } from '@/services/nsfwDetector';
import { deduplicateByLink } from '@/services/ranking';
import { sendBreakingNotificationBatch } from '@/services/notifications';
import { requestBackgroundFetch } from '@/services/backgroundFetch';
import { SearchBar } from '@/components/common';
import { DigestCard, FilterModal } from '@/components/digest';
import { ArticleSkeleton, EmptyState, Button } from '@/components/ui';
import { Newspaper, RefreshCw, ArrowUp } from 'lucide-react-native';

const AnimatedPressable = ReAnimated.createAnimatedComponent(Pressable);

export default function DigestScreen() {
  const { colors, compactMode, dataVersion, notifyBreaking, autoMarkRead, bumpDataVersion } = useApp();
  const { hapticMedium } = useHaptics();
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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  // Local classifying state - replaces useSyncExternalStore
  const [classifyingIds, setClassifyingIds] = useState<Set<string>>(new Set());
  
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);
  const listRef = useRef<any>(null);
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const fetchNewsRef = useRef<(skipCache: boolean) => Promise<void>>(async () => {});
  const markedReadRef = useRef<Set<string>>(new Set());

  // NSFW classification queue with batching
  const classificationQueueRef = useRef<{ id: string; imageUri: string; title: string }[]>([]);
  const isProcessingRef = useRef(false);
  const pendingUpdatesRef = useRef<Map<string, number>>(new Map());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const articlesRef = useRef<Article[]>(articles);
  articlesRef.current = articles;
  const classificationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Flush pending NSFW updates to state + DB in batch
  const flushPendingUpdates = useCallback(async () => {
    const updates = [...pendingUpdatesRef.current.entries()];
    pendingUpdatesRef.current.clear();
    
    if (updates.length === 0) return;
    
    // Batch update UI state
    setArticles((prev) =>
      prev.map((a) => {
        const status = pendingUpdatesRef.current.get(a.id) ?? updates.find(([id]) => id === a.id)?.[1];
        return status ? { ...a, nsfw_status: status } : a;
      })
    );
    
    // Batch update DB
    await Promise.all(updates.map(([id, status]) => updateArticleNsfwStatus(id, status)));
    
    // Remove from classifying set
    setClassifyingIds((prev) => {
      const next = new Set(prev);
      updates.forEach(([id]) => next.delete(id));
      return next;
    });
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushPendingUpdates, 2000);
  }, [flushPendingUpdates]);

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    
    while (classificationQueueRef.current.length > 0) {
      const batch = classificationQueueRef.current.splice(0, 2);
      await Promise.allSettled(
        batch.map(async ({ id, imageUri, title }) => {
          try {
            const article = articlesRef.current.find((a) => a.id === id);
            if (!article?.image_uri || article.nsfw_status !== 0) return;
            const result = await classifyImage(imageUri, title);
            if (!result) return;
            const newStatus = result.isNSFW ? 2 : 1;
            pendingUpdatesRef.current.set(id, newStatus);
          } finally {
            // Don't remove from classifyingIds here - done in flush
          }
        }),
      );
      scheduleFlush();
    }
    isProcessingRef.current = false;
  }, [scheduleFlush]);

  const enqueueClassification = useCallback(
    (article: Article) => {
      if (classifyingIds.has(article.id)) return;
      setClassifyingIds((prev) => {
        const next = new Set(prev);
        next.add(article.id);
        return next;
      });
      classificationQueueRef.current.push({ id: article.id, imageUri: article.image_uri!, title: article.title });
      processQueue();
    },
    [classifyingIds, processQueue],
  );

  const fabScale = useSharedValue(0);
  const listOpacity = useSharedValue(0);

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const listAnimatedStyle = useAnimatedStyle(() => ({
    opacity: listOpacity.value,
  }));

  useEffect(() => {
    if (initialLoadComplete) {
      // eslint-disable-next-line react-hooks/immutability
      listOpacity.value = withTiming(1, { duration: 400 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoadComplete]);

  const viewabilityConfig = useMemo(() => ({
    itemVisiblePercentThreshold: 50,
  }), []);

  const onViewableItemsChangedRef = useRef((...args: any[]) => {});
  
  onViewableItemsChangedRef.current = ({ viewableItems }: { viewableItems: { item: Article }[] }) => {
    // Auto mark read
    if (autoMarkRead) {
      viewableItems.forEach(({ item }) => {
        if (!markedReadRef.current.has(item.id)) {
          markedReadRef.current.add(item.id);
          markRead(item.id);
        }
      });
    }
    // Classify ONLY visible items (no buffer), debounced
    if (!isNSFWReady()) return;
    if (classificationDebounceRef.current) clearTimeout(classificationDebounceRef.current);
    classificationDebounceRef.current = setTimeout(() => {
      const currentArticles = articlesRef.current;
      viewableItems.forEach(({ item }) => {
        const article = currentArticles.find((a) => a.id === item.id);
        if (article?.image_uri && article.nsfw_status === 0) {
          enqueueClassification(article);
        }
      });
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (classificationDebounceRef.current) clearTimeout(classificationDebounceRef.current);
    };
  }, []);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: { item: Article }[] }) => {
    onViewableItemsChangedRef.current({ viewableItems });
  }, []);

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
    const loadingToastId = toast.loading('Fetching latest articles...');
    try {
      const rawArticles = await fetchAllFeeds(skipCache);
      await new Promise(r => setTimeout(r, 0)); // yield
      
      const unique = deduplicateByLink(rawArticles);
      await new Promise(r => setTimeout(r, 0)); // yield
      
      const notifiedIds = await getNotifiedArticleIds();
      const breaking = notifyBreaking
        ? unique.filter(a => a.importance_score === 5 && !notifiedIds.has(a.id))
        : [];

      const saved = await saveArticles(unique);
      await new Promise(r => setTimeout(r, 0)); // yield
      
      toast.dismiss(loadingToastId);
      toast.success(`${saved} new articles loaded`);

      await loadData(searchQuery);

      // Defer non-critical work until after UI is responsive
      InteractionManager.runAfterInteractions(() => {
        pruneOldArticles().then(pruned => {
          console.log(`Pruned ${pruned} old articles`);
        });
        
        if (breaking.length > 0) {
          sendBreakingNotificationBatch(
            breaking.map(a => ({ title: a.title, sourceName: a.source_name, id: a.id }))
          ).then(() => {
            markArticlesNotified(breaking.map(a => a.id));
          });
        }
      });
    } catch (error) {
      console.error('Failed to fetch news:', error);
      toast.dismiss(loadingToastId);
      toast.error('Could not fetch feeds. Pull down to try again.');
    } finally {
      setFetching(false);
    }
  }, [fetching, loadData, searchQuery, notifyBreaking]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNews(false);
    setRefreshing(false);
  }, [fetchNews]);

  useEffect(() => {
    fetchNewsRef.current = fetchNews;
  }, [fetchNews]);

  useEffect(() => {
    const init = async () => {
      await loadData(searchQuery);
      setInitialLoadComplete(true);
      const [count, initialFetchDone] = await Promise.all([
        getArticleCount(),
        getSetting<boolean>('initialFetchDone', false),
      ]);
      if (count === 0 && !initialFetchDone) {
        await fetchNewsRef.current(false);
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

  // Auto-fetch every 15 min while foregrounded + on app foreground
  useEffect(() => {
    const interval = setInterval(() => requestBackgroundFetch(), 15 * 60 * 1000);

    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        requestBackgroundFetch();
      }
      appState.current = nextState;
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

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
    hapticMedium();
    const newState = await toggleBookmark(id);
    setArticles(prev => prev.map(a => a.id === id ? { ...a, is_bookmarked: newState } : a));
    bumpDataVersion();
  }, [hapticMedium, bumpDataVersion]);

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
        const shouldShow = offsetY > 600;
        if (shouldShow !== showScrollTop) {
          setShowScrollTop(shouldShow);
        }
      },
    }
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    fabScale.value = withSpring(showScrollTop ? 1 : 0, { stiffness: 600, damping: 100 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScrollTop]);

  function handleFabPressIn() {
    // eslint-disable-next-line react-hooks/immutability
    fabScale.value = withTiming(0.9, { duration: 60 });
  }

  function handleFabPressOut() {
    // eslint-disable-next-line react-hooks/immutability
    fabScale.value = withTiming(1, { duration: 100 });
  }

  const scrollToTop = useCallback(() => {
    hapticMedium();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, [hapticMedium]);

  const renderArticle = useCallback(({ item }: { item: Article }) => (
    <DigestCard
      article={item}
      variant={compactMode ? 'compact' : 'full'}
      onBookmark={handleBookmark}
      isClassifying={classifyingIds.has(item.id)}
    />
  ), [compactMode, handleBookmark, classifyingIds]);

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
        <ReAnimated.View style={[{ flex: 1 }, listAnimatedStyle]}>
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
            <AnimatedPressable
              onPress={scrollToTop}
              onPressIn={handleFabPressIn}
              onPressOut={handleFabPressOut}
              style={[
                fabAnimatedStyle,
                styles.fab,
                {
                  backgroundColor: colors.brandPrimary,
                  bottom: insets.bottom + Spacing.xxl,
                },
              ]}
            >
              <ArrowUp size={24} color={colors.textInverse} />
            </AnimatedPressable>
          )}
        </ReAnimated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: Spacing.lg },
  listContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
  searchingIndicator: { paddingVertical: Spacing.md, alignItems: 'center' },
  footerLoader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg,
  },
  fab: {
    position: 'absolute', right: Spacing.lg, width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center', elevation: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4,
  },
});
