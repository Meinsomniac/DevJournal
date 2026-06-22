import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Text, Pressable, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Article } from '@/types';
import { getArticleById, toggleBookmark, markRead } from '@/services/db';
import { formatDateTime } from '@/utils/date';
import { ImportanceStars, SourceIcon } from '@/components/ui';
import { Bookmark, ExternalLink } from 'lucide-react-native';
import { FEED_SOURCES } from '@/constants/Feeds';

const ICON_BY_NAME = new Map(FEED_SOURCES.map((s) => [s.name, s.icon]));

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadArticle = async () => {
      if (!id) return;

      try {
        const found = await getArticleById(id);
        setArticle(found);

        // Mark as read
        if (found) {
          await markRead(id);
        }
      } catch (error) {
        console.error('Failed to load article:', error);
      } finally {
        setLoading(false);
      }
    };

    loadArticle();
  }, [id]);

  const handleBookmark = useCallback(async () => {
    if (!article) return;

    const newState = await toggleBookmark(article.id);
    setArticle({ ...article, is_bookmarked: newState });
  }, [article]);

  const handleOpenExternal = useCallback(async () => {
    if (!article) return;
    await WebBrowser.openBrowserAsync(article.link);
  }, [article]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.bgPrimary, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ActivityIndicator size="large" color={colors.brandPrimary} />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.bgPrimary, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={[Typography.headlineMedium, { color: colors.textPrimary }]}>
          Article not found
        </Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.goBackButton,
            { backgroundColor: colors.brandPrimary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[Typography.labelLarge, { color: colors.textInverse }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerBackTitle: 'Back',
          headerTitle: '',
          headerTintColor: colors.textPrimary,
          headerStyle: { backgroundColor: colors.bgPrimary },
          headerRight: () => (
            <Pressable onPress={handleBookmark} style={styles.headerIcon}>
              <Bookmark
                size={22}
                color={article.is_bookmarked ? colors.warning : colors.textSecondary}
                fill={article.is_bookmarked ? colors.warning : 'transparent'}
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.bgPrimary }]}
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <View style={styles.heroHeader}>
            <ImportanceStars score={article.importance_score} size={14} color={colors.warning} />
          </View>

          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {article.title}
          </Text>

          <View style={styles.metaInfo}>
            <SourceIcon
              iconUri={article.source_icon_uri ?? ICON_BY_NAME.get(article.source_name)}
              name={article.source_name}
              size={20}
              backgroundColor={colors.borderLight}
              color={colors.brandPrimary}
            />
            <Text style={[styles.sourceName, { color: colors.brandPrimary }]}>
              {article.source_name}
            </Text>
            <Text style={[Typography.bodySmall, { color: colors.textTertiary }]}>
              {formatDateTime(article.pub_date)}
            </Text>
          </View>
        </View>

        {article.summary && (
          <View style={styles.summarySection}>
            <Text style={[Typography.labelSmall, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>
              SUMMARY
            </Text>
            <Text style={[Typography.bodyLarge, { color: colors.textPrimary }]}>
              {article.summary}
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.bgPrimary, paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={handleOpenExternal}
          style={({ pressed }) => [
            styles.readButton,
            { backgroundColor: colors.brandPrimary, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={[Typography.labelLarge, { color: colors.textInverse }]}>
            Read Full Article
          </Text>
          <ExternalLink size={18} color={colors.textInverse} style={{ marginLeft: Spacing.xs }} />
        </Pressable>
        <Text style={[Typography.labelSmall, { color: colors.textTertiary, marginTop: Spacing.sm, textAlign: 'center' }]}>
          Opens in your browser
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
  },
  headerIcon: {
    padding: Spacing.sm,
  },
  content: {
    padding: Spacing.lg,
  },
  hero: {
    marginBottom: Spacing.lg,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  sourceName: {
    fontWeight: '600',
  },
  summarySection: {
    marginBottom: Spacing.xl,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  readButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    minWidth: 200,
  },
  goBackButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
});
