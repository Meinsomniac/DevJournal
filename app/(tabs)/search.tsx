import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Text,
  Pressable,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Article } from '@/types';
import { searchArticles, getArticleCount } from '@/services/db';
import { Header } from '@/components/common/Header';
import { ImportanceStars, CategoryChip, EmptyState } from '@/components/ui';
import { formatRelative } from '@/utils/date';
import { Search, X, Clock, ArrowRight } from 'lucide-react-native';

interface SearchResult extends Article {
  highlighted_summary?: string;
}

export default function SearchScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [articleCount, setArticleCount] = useState(0);

  React.useEffect(() => {
    const init = async () => {
      const count = await getArticleCount();
      setArticleCount(count);
      // Load recent searches from storage
      // For simplicity, we'll just use state
    };
    init();
  }, []);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setSearching(true);
    setHasSearched(true);
    Keyboard.dismiss();

    try {
      const searchResults = await searchArticles(searchQuery.trim(), 50);
      setResults(searchResults);

      // Add to recent searches
      setRecentSearches((prev) => {
        const updated = [searchQuery.trim(), ...prev.filter((s) => s !== searchQuery.trim())].slice(0, 5);
        return updated;
      });
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }, []);

  const handleArticlePress = useCallback((article: Article) => {
    router.push(`/article/${article.id}`);
  }, [router]);

  const handleRecentSearch = useCallback((term: string) => {
    setQuery(term);
    performSearch(term);
  }, [performSearch]);

  const renderResultItem = ({ item }: { item: SearchResult }) => (
    <Pressable
      style={[styles.resultItem, { backgroundColor: colors.bgCard }]}
      onPress={() => handleArticlePress(item)}
    >
      <View style={styles.resultHeader}>
        <ImportanceStars score={item.importance_score} size={10} />
        <CategoryChip category={item.category} size="small" variant="outline" />
      </View>
      <Text
        style={[Typography.titleMedium, { color: colors.textPrimary }]}
        numberOfLines={2}
      >
        {item.title}
      </Text>
      {item.highlighted_summary ? (
        <Text
          style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.xs }]}
          numberOfLines={2}
        >
          {item.highlighted_summary.replace(/<\/?mark>/g, '')}
        </Text>
      ) : item.summary && (
        <Text
          style={[Typography.bodySmall, { color: colors.textSecondary, marginTop: Spacing.xs }]}
          numberOfLines={2}
        >
          {item.summary}
        </Text>
      )}
      <View style={styles.resultMeta}>
        <Text style={[Typography.labelSmall, { color: colors.brandPrimary }]}>
          {item.source_name}
        </Text>
        <Text style={[Typography.labelSmall, { color: colors.textTertiary }]}>
          {formatRelative(item.pub_date)}
        </Text>
      </View>
      <ArrowRight size={16} color={colors.textTertiary} style={styles.resultArrow} />
    </Pressable>
  );

  const renderRecentSearches = () => (
    <View style={styles.recentSection}>
      <Text style={[Typography.labelSmall, { color: colors.textTertiary, marginBottom: Spacing.md }]}>
        RECENT SEARCHES
      </Text>
      {recentSearches.length > 0 ? (
        <View style={styles.recentTags}>
          {recentSearches.map((term) => (
            <Pressable
              key={term}
              style={[styles.recentTag, { backgroundColor: colors.bgTertiary }]}
              onPress={() => handleRecentSearch(term)}
            >
              <Clock size={14} color={colors.textSecondary} />
              <Text style={[Typography.labelMedium, { color: colors.textSecondary }]}>
                {term}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
          No recent searches
        </Text>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      <Header title="Search" subtitle={`${articleCount} articles indexed`} />

      <View style={styles.searchContainer}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.borderLight }]}>
          <Search size={20} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Search articles, tools, repos..."
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => performSearch(query)}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
          />
          {query.length > 0 && (
            <Pressable onPress={handleClearSearch}>
              <X size={20} color={colors.textTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {!hasSearched && !searching && (
        <View style={styles.content}>
          {renderRecentSearches()}
          <View style={styles.suggestionsSection}>
            <Text style={[Typography.labelSmall, { color: colors.textTertiary, marginBottom: Spacing.md }]}>
              SUGGESTED SEARCHES
            </Text>
            <View style={styles.recentTags}>
              {['React Native', 'AI', 'TypeScript', 'Kubernetes'].map((term) => (
                <Pressable
                  key={term}
                  style={[styles.suggestionTag, { backgroundColor: colors.brandPrimary + '15' }]}
                  onPress={() => {
                    setQuery(term);
                    performSearch(term);
                  }}
                >
                  <Text style={[Typography.labelMedium, { color: colors.brandPrimary }]}>
                    {term}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}

      {searching && (
        <View style={styles.loadingContainer}>
          <Text style={[Typography.bodyMedium, { color: colors.textSecondary }]}>
            Searching...
          </Text>
        </View>
      )}

      {hasSearched && !searching && results.length === 0 && (
        <EmptyState
          icon={Search}
          title="No results found"
          description={`No articles match "${query}". Try different keywords or broader terms.`}
        />
      )}

      {hasSearched && !searching && results.length > 0 && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={renderResultItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[Typography.labelMedium, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
              {results.length} {results.length === 1 ? 'result' : 'results'} for &quot;{query}&quot;
            </Text>
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
  searchContainer: {
    paddingHorizontal: Spacing.lg,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentSection: {
    marginBottom: Spacing.xxl,
  },
  suggestionsSection: {
    marginTop: Spacing.md,
  },
  recentTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  recentTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
    gap: Spacing.xs,
  },
  suggestionTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
  },
  listContent: {
    padding: Spacing.lg,
  },
  resultItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  resultMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  resultArrow: {
    position: 'absolute',
    right: Spacing.md,
    top: '50%',
    marginTop: -8,
  },
});
