import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/AppContext';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Article } from '@/types';
import { getBookmarks, getHistory, toggleBookmark } from '@/services/db';
import { Header } from '@/components/common/Header';
import { EmptyState } from '@/components/ui';
import { getDayName } from '@/utils/date';
import { Bookmark, History } from 'lucide-react-native';
import { DigestCard } from '@/components/digest';

type TabType = 'bookmarks' | 'history';

export default function SavedScreen() {
  const { colors, compactMode, bumpDataVersion } = useApp();
  const insets = useSafeAreaInsets();
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

  const handleToggleBookmark = useCallback(async (id: string) => {
    await toggleBookmark(id);
    bumpDataVersion();
    await loadData();
  }, [loadData, bumpDataVersion]);

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
    <DigestCard
      article={item}
      variant={compactMode ? 'compact' : 'full'}
      onBookmark={handleToggleBookmark}
    />
  ), [compactMode, handleToggleBookmark]);

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
          <DigestCard
            key={article.id}
            article={article}
            variant={compactMode ? 'compact' : 'full'}
            onBookmark={handleToggleBookmark}
          />
        ))}
      </View>
    ));
  };

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
        <View style={[styles.emptyWrapper, { paddingBottom: insets.bottom + Spacing.xxl }]}>
          <EmptyState
            icon={Bookmark}
            title="No bookmarks yet"
            description="Save articles to read later by tapping the bookmark icon."
          />
        </View>
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
  emptyWrapper: {
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
  historySection: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
});
