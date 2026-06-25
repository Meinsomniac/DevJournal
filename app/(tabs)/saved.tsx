import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { useApp } from '@/context/AppContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { Article } from '@/types';
import { getBookmarks, toggleBookmark } from '@/services/db';
import { Header } from '@/components/common/Header';
import { EmptyState } from '@/components/ui';
import { Bookmark } from 'lucide-react-native';
import { DigestCard } from '@/components/digest';

export default function SavedScreen() {
  const { colors, compactMode, bumpDataVersion, dataVersion } = useApp();
  const { hapticMedium } = useHaptics();
  const insets = useSafeAreaInsets();

  const [bookmarks, setBookmarks] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const bookmarked = await getBookmarks();
      setBookmarks(bookmarked);
    } catch (error) {
      console.error('Failed to load saved data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => loadData(), 0);
    return () => clearTimeout(timer);
  }, [loadData, dataVersion]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const handleToggleBookmark = useCallback(async (id: string) => {
    const article = bookmarks.find(b => b.id === id);
    const wasBookmarked = article?.is_bookmarked;
    hapticMedium();
    await toggleBookmark(id);
    if (wasBookmarked) {
      setBookmarks(prev => prev.filter(a => a.id !== id));
    }
    toast.success(wasBookmarked ? 'Removed from bookmarks' : 'Saved to bookmarks');
  }, [hapticMedium, bookmarks]);

  const renderBookmarkItem = useCallback(({ item }: { item: Article }) => (
    <DigestCard
      article={item}
      variant={compactMode ? 'compact' : 'full'}
      onBookmark={handleToggleBookmark}
    />
  ), [compactMode, handleToggleBookmark]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Header title="Saved" />
        <View style={[styles.loadingContainer, { paddingBottom: insets.bottom + Spacing.xxl }]}>
          <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header
        title="Saved"
        subtitle={`${bookmarks.length} bookmarks`}
      />

      {bookmarks.length === 0 ? (
        <View style={[styles.emptyWrapper, { paddingBottom: insets.bottom + Spacing.xxl }]}>
          <EmptyState
            icon={Bookmark}
            title="No bookmarks yet"
            description="Save articles to read later by tapping the bookmark icon."
          />
        </View>
      ) : (
        <FlashList
          data={bookmarks}
          keyExtractor={(item) => item.id}
          renderItem={renderBookmarkItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          refreshing={refreshing}
          onRefresh={onRefresh}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyWrapper: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: Spacing.lg,
  },
});
