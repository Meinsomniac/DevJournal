import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Article } from '@/types';
import { getBookmarks, getHistory, deleteBookmark } from '@/services/db';
import { Header } from '@/components/common/Header';
import { ImportanceStars, CategoryChip, EmptyState } from '@/components/ui';
import { formatRelative, getDayName } from '@/utils/date';
import { Bookmark, History, Trash2, ChevronRight } from 'lucide-react-native';

type TabType = 'bookmarks' | 'history';

export default function SavedScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<TabType>('bookmarks');
  const [bookmarks, setBookmarks] = useState<Article[]>([]);
  const [history, setHistory] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [bookmarked, readHistory] = await Promise.all([
        getBookmarks(),
        getHistory(100),
      ]);
      setBookmarks(bookmarked);
      setHistory(readHistory);
    } catch (error) {
      console.error('Failed to load saved data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const init = async () => { await loadData(); };
    init();
    const unsubscribe = navigation.addListener('focus', loadData);
    return unsubscribe;
  }, [loadData, navigation]);

  const handleRemoveBookmark = useCallback(async (id: string) => {
    await deleteBookmark(id);
    await loadData();
  }, [loadData]);

  const handleOpenArticle = useCallback((article: Article) => {
    router.push(`/article/${article.id}`);
  }, [router]);

  const displayData = activeTab === 'bookmarks' ? bookmarks : history;

  // Group history by date
  const groupedHistory = React.useMemo(() => {
    if (activeTab !== 'history') return {};

    const groups: Record<string, Article[]> = {};
    history.forEach((article) => {
      const day = getDayName(article.pub_date);
      if (!groups[day]) groups[day] = [];
      groups[day].push(article);
    });
    return groups;
  }, [history, activeTab]);

  const renderBookmarkItem = useCallback(({ item }: { item: Article }) => (
    <Pressable
      style={[styles.card, { backgroundColor: colors.bgCard }]}
      onPress={() => handleOpenArticle(item)}
    >
      <View style={styles.cardHeader}>
        <ImportanceStars score={item.importance_score} size={10} />
        <CategoryChip category={item.category} size="small" />
      </View>
      <Text
        style={[Typography.titleMedium, { color: colors.textPrimary }]}
        numberOfLines={2}
      >
        {item.title}
      </Text>
      <View style={styles.cardMeta}>
        <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>
          {item.source_name} · Saved {formatRelative(item.pub_date)}
        </Text>
      </View>
      <View style={styles.cardActions}>
        <Pressable
          style={styles.cardAction}
          onPress={() => handleOpenArticle(item)}
        >
          <ChevronRight size={16} color={colors.brandPrimary} />
          <Text style={[Typography.labelMedium, { color: colors.brandPrimary }]}>
            Read
          </Text>
        </Pressable>
        <Pressable
          style={styles.cardAction}
          onPress={() => handleRemoveBookmark(item.id)}
        >
          <Trash2 size={16} color={colors.error} />
          <Text style={[Typography.labelMedium, { color: colors.error }]}>
            Remove
          </Text>
        </Pressable>
      </View>
    </Pressable>
  ), [colors, handleOpenArticle, handleRemoveBookmark]);

  const renderHistorySection = () => {
    if (activeTab !== 'history') return null;

    const sections = Object.entries(groupedHistory);

    if (sections.length === 0) {
      return (
        <EmptyState
          icon={History}
          title="No reading history"
          description="Articles you've read will appear here."
        />
      );
    }

    return sections.map(([day, articles]) => (
      <View key={day} style={styles.historySection}>
        <Text style={[Typography.headlineSmall, { color: colors.textPrimary }]}>
          {day}
        </Text>
        {articles.map((article) => (
          <Pressable
            key={article.id}
            style={[styles.historyItem, { backgroundColor: colors.bgCard }]}
            onPress={() => handleOpenArticle(article)}
          >
            <Text
              style={[Typography.bodyMedium, { color: colors.textPrimary }]}
              numberOfLines={1}
            >
              {article.title}
            </Text>
            <Text style={[Typography.labelSmall, { color: colors.textTertiary }]}>
              {formatRelative(article.pub_date)}
            </Text>
          </Pressable>
        ))}
      </View>
    ));
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
        <Header title="Saved" />
        <View style={styles.loadingContainer}>
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
        subtitle={`${bookmarks.length} bookmarks · ${history.length} in history`}
      />

      <View style={styles.tabBar}>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'bookmarks' && { backgroundColor: colors.brandPrimary + '20' },
          ]}
          onPress={() => setActiveTab('bookmarks')}
        >
          <Bookmark
            size={18}
            color={activeTab === 'bookmarks' ? colors.brandPrimary : colors.textSecondary}
          />
          <Text
            style={[
              Typography.labelLarge,
              {
                color: activeTab === 'bookmarks' ? colors.brandPrimary : colors.textSecondary,
              },
            ]}
          >
            Bookmarks
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.tabButton,
            activeTab === 'history' && { backgroundColor: colors.brandPrimary + '20' },
          ]}
          onPress={() => setActiveTab('history')}
        >
          <History
            size={18}
            color={activeTab === 'history' ? colors.brandPrimary : colors.textSecondary}
          />
          <Text
            style={[
              Typography.labelLarge,
              {
                color: activeTab === 'history' ? colors.brandPrimary : colors.textSecondary,
              },
            ]}
          >
            History
          </Text>
        </Pressable>
      </View>

      {activeTab === 'bookmarks' && displayData.length === 0 && (
        <EmptyState
          icon={Bookmark}
          title="No bookmarks yet"
          description="Save articles to read later by tapping the bookmark icon."
        />
      )}

      {activeTab === 'bookmarks' && displayData.length > 0 && (
        <FlashList
          data={displayData}
          keyExtractor={(item) => item.id}
          renderItem={renderBookmarkItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {activeTab === 'history' && (
        <FlashList
          data={[{ key: 'sections' }]}
          keyExtractor={() => 'sections'}
          renderItem={() => <>{renderHistorySection()}</>}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon={History}
              title="No reading history"
              description="Articles you've read will appear here."
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  listContent: {
    padding: Spacing.lg,
  },
  card: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cardMeta: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
  },
  cardAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
  },
  historySection: {
    marginBottom: Spacing.lg,
  },
  historyItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
});
