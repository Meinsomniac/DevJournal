import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { Spacing } from '@/constants/Spacing';
import { Article } from '@/types';
import { getDigestFeed, searchArticles, toggleBookmark, getUnreadCount, saveArticles } from '@/services/db';
import { fetchAllFeeds } from '@/services/rssParser';
import { deduplicateByLink } from '@/services/ranking';
import { SearchBar } from '@/components/common';
import { DigestCard, SectionHeader } from '@/components/digest';
import { ArticleSkeleton, EmptyState, Button } from '@/components/ui';
import { Newspaper, RefreshCw } from 'lucide-react-native';

export default function DigestScreen() {
  const { colors, compactMode, dataVersion } = useApp();
  const insets = useSafeAreaInsets();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async (searchText: string) => {
    try {
      if (searchText.trim()) {
        setSearching(true);
        const results = await searchArticles(searchText.trim(), 50);
        setArticles(results);
      } else {
        const feed = await getDigestFeed(50);
        setArticles(feed);
      }
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to load articles:', error);
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    loadData(searchQuery);
  }, [dataVersion]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(searchQuery);
    setRefreshing(false);
  }, [loadData, searchQuery]);

  const fetchNews = useCallback(async () => {
    if (fetching) return;
    setFetching(true);
    try {
      const rawArticles = await fetchAllFeeds();
      const unique = deduplicateByLink(rawArticles);
      const saved = await saveArticles(unique);
      console.log(`Saved ${saved} new articles`);
      await loadData(searchQuery);
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setFetching(false);
    }
  }, [fetching, loadData, searchQuery]);

  const handleSearchTextChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadData(text);
    }, 300);
  }, [loadData]);

  const handleSearchSubmit = useCallback((text: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    loadData(text);
  }, [loadData]);

  const handleBookmark = useCallback(async (id: string) => {
    await toggleBookmark(id);
    await loadData(searchQuery);
  }, [loadData, searchQuery]);

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
    <View style={[styles.container, { backgroundColor: colors.bgPrimary, paddingTop: insets.top }]}>
      <SearchBar
        value={searchQuery}
        onChangeText={handleSearchTextChange}
        onSubmitEditing={handleSearchSubmit}
        placeholder="Search articles..."
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
});