import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Article } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';
import { formatRelative } from '@/utils/date';
import { ImportanceStars, SourceIcon } from '@/components/ui';
import { CategoryChip } from '@/components/ui/CategoryChip';
import { Bookmark, ChevronRight } from 'lucide-react-native';
import { FEED_SOURCES } from '@/constants/Feeds';

const ICON_BY_NAME = new Map(
  FEED_SOURCES.map((s) => [s.name, s.icon])
);

interface DigestCardProps {
  article: Article;
  variant?: 'full' | 'compact';
  onBookmark: (id: string) => void;
}

export function DigestCard({ article, variant = 'full', onBookmark }: DigestCardProps) {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const iconUri = article.source_icon_uri ?? ICON_BY_NAME.get(article.source_name);

  const handlePress = () => {
    router.push(`/article/${article.id}`);
  };

  const handleBookmark = () => {
    onBookmark(article.id);
  };

  if (variant === 'compact') {
    return (
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.compactContainer,
          { backgroundColor: colors.bgCard },
          pressed && { backgroundColor: colors.bgCardHover },
          !article.is_read && styles.unreadIndicator,
          !article.is_read && { borderLeftColor: colors.brandPrimary },
        ]}
      >
        {article.image_uri && (
          <Image source={{ uri: article.image_uri }} style={styles.compactImage} />
        )}
        <View style={styles.compactContent}>
          <ImportanceStars score={article.importance_score} size={10} />
          <Text
            style={[Typography.titleSmall, { color: colors.textPrimary }]}
            numberOfLines={2}
          >
            {article.title}
          </Text>
          <View style={styles.compactMeta}>
            <SourceIcon
              iconUri={iconUri}
              name={article.source_name}
              size={14}
              backgroundColor={colors.borderLight}
              color={colors.textSecondary}
            />
            <Text style={[Typography.labelSmall, { color: colors.textSecondary }]}>
              {article.source_name} · {formatRelative(article.pub_date)}
            </Text>
          </View>
        </View>
        <ChevronRight size={20} color={colors.textTertiary} />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: colors.bgCard },
        isDark ? Shadows.dark.card : Shadows.light.card,
        pressed && { backgroundColor: colors.bgCardHover },
        !article.is_read && styles.unreadIndicator,
        !article.is_read && { borderLeftColor: colors.brandPrimary },
      ]}
    >
      <View style={styles.header}>
        <ImportanceStars score={article.importance_score} size={12} color={colors.warning} />
        <View style={styles.headerRight}>
          <CategoryChip category={article.category} size="small" />
          {article.is_bookmarked ? (
            <Bookmark size={16} color={colors.warning} fill={colors.warning} />
          ) : null}
        </View>
      </View>

      {article.image_uri && (
        <Image source={{ uri: article.image_uri }} style={styles.image} />
      )}

      <Text
        style={[Typography.headlineSmall, { color: colors.textPrimary }, styles.title]}
        numberOfLines={2}
      >
        {article.title}
      </Text>

      <View style={styles.meta}>
        <SourceIcon
          iconUri={iconUri}
          name={article.source_name}
          size={18}
          backgroundColor={colors.borderLight}
          color={colors.brandPrimary}
        />
        <Text style={[Typography.labelMedium, { color: colors.brandPrimary }]}>
          {article.source_name}
        </Text>
        <Text style={[Typography.labelMedium, { color: colors.textTertiary }]}>
          {formatRelative(article.pub_date)}
        </Text>
      </View>

      {article.summary && (
        <Text
          style={[Typography.bodyMedium, { color: colors.textSecondary }, styles.summary]}
          numberOfLines={3}
        >
          {article.summary}
        </Text>
      )}

      <View style={styles.actions}>
        <Pressable onPress={handlePress} style={styles.readButton}>
          <Text style={[Typography.labelLarge, { color: colors.brandPrimary }]}>
            Read
          </Text>
        </Pressable>
        <View style={styles.iconButtons}>
          <Pressable onPress={handleBookmark} style={styles.iconButton}>
            <Bookmark
              size={18}
              color={colors.textSecondary}
              fill={article.is_bookmarked ? colors.textSecondary : 'transparent'}
            />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  unreadIndicator: {
    borderLeftWidth: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  image: {
    width: '100%',
    height: 160,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  compactImage: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  compactContent: {
    flex: 1,
    gap: 4,
  },
  compactMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    marginBottom: Spacing.xs,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summary: {
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(14, 165, 233, 0.1)',
    borderRadius: BorderRadius.md,
  },
  iconButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  iconButton: {
    padding: Spacing.sm,
  },
});
