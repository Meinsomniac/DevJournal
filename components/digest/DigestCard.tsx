import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Animated as RNAnimated } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { Article } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { useHaptics } from '@/hooks/useHaptics';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Shadows } from '@/constants/Shadows';
import { formatRelative } from '@/utils/date';
import { ImportanceStars, SourceIcon, BrokenImageIcon } from '@/components/ui';
import { toast } from 'sonner-native';
import { Bookmark, ChevronRight, Sparkles } from 'lucide-react-native';
import { FEED_SOURCES } from '@/constants/Feeds';

const ICON_BY_NAME = new Map(
  FEED_SOURCES.map((s) => [s.name, s.icon])
);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DigestCardProps {
  article: Article;
  variant?: 'full' | 'compact';
  onBookmark: (id: string) => void;
  isClassifying?: boolean;
}

export const DigestCard = React.memo(function DigestCard({ article, variant = 'full', onBookmark, isClassifying = false }: DigestCardProps) {
  const { colors, isDark } = useTheme();
  const { hapticMedium } = useHaptics();
  const router = useRouter();
  const iconUri = article.source_icon_uri ?? ICON_BY_NAME.get(article.source_name);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [article.id]);

  const pulseAnim = useRef(new RNAnimated.Value(1)).current;

  useEffect(() => {
    if (isClassifying) {
      const animation = RNAnimated.loop(
        RNAnimated.sequence([
          RNAnimated.timing(pulseAnim, { toValue: 0.1, duration: 700, useNativeDriver: true }),
          RNAnimated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
      );
      animation.start();
      return () => animation.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isClassifying, pulseAnim]);

  const bookmarkScale = useSharedValue(1);
  const bookmarkRotation = useSharedValue(0);

  const bookmarkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: bookmarkScale.value },
      { rotate: `${interpolate(bookmarkRotation.value, [0, 1], [0, 10])}deg` },
    ],
  }));

  const handlePress = () => {
    router.push(`/article/${article.id}`);
  };

  const handleBookmark = () => {
    hapticMedium();
    bookmarkScale.value = withSpring(1.3, { stiffness: 600, damping: 300 }, () => {
      bookmarkScale.value = withSpring(1, { stiffness: 600, damping: 300 });
    });
    bookmarkRotation.value = withTiming(1, { duration: 150 }, () => {
      bookmarkRotation.value = withTiming(0, { duration: 150 });
    });
    onBookmark(article.id);
  };

  if (variant === 'compact') {
    return (
      <AnimatedPressable
        onPress={handlePress}
        style={[
          styles.compactContainer,
          { backgroundColor: colors.bgCard },
        ]}
      >
        {!article.image_uri || imgError ? (
          <View style={[styles.compactImage, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}>
            <SourceIcon
              iconUri={iconUri}
              name={article.source_name}
              size={20}
              backgroundColor={colors.bgCard}
              color={colors.textTertiary}
            />
          </View>
        ) : isClassifying ? (
          <RNAnimated.View style={[styles.compactImage, { backgroundColor: colors.borderLight, opacity: pulseAnim }]} />
        ) : article.nsfw_status === 2 ? (
          <View style={[styles.compactImage, { backgroundColor: colors.borderLight, alignItems: 'center', justifyContent: 'center' }]}>
            <BrokenImageIcon size={20} />
          </View>
        ) : (
          <Image source={{ uri: article.image_uri }} style={styles.compactImage} onError={() => setImgError(true)} />
        )}
        <View style={styles.compactContent}>
          <View style={styles.compactTop}>
            <ImportanceStars score={article.importance_score} size={10} color={colors.warning} animate={article.importance_score === 5} />
          </View>
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
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
        onPress={handlePress}
        style={[
          styles.container,
          { backgroundColor: colors.bgCard },
          isDark ? Shadows.dark.card : Shadows.light.card,
        ]}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ImportanceStars score={article.importance_score} size={12} color={colors.warning} animate={article.importance_score === 5} />
        </View>
        <View style={styles.headerRight}>
          </View>
      </View>

      {!article.image_uri || imgError ? (
        <View style={[styles.imagePlaceholder, { backgroundColor: colors.borderLight }]}>
          <SourceIcon
            iconUri={iconUri}
            name={article.source_name}
            size={32}
            backgroundColor={colors.bgCard}
            color={colors.textTertiary}
          />
        </View>
      ) : isClassifying ? (
        <RNAnimated.View style={[styles.image, { backgroundColor: colors.borderLight, opacity: pulseAnim }]} />
      ) : article.nsfw_status === 2 ? (
        <View style={[styles.imagePlaceholder, { backgroundColor: colors.borderLight }]}>
          <BrokenImageIcon size={32} />
        </View>
      ) : (
        <Image source={{ uri: article.image_uri }} style={styles.image} onError={() => setImgError(true)} />
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
        <Pressable
          style={[styles.aiInsightButton, { opacity: 0.7 }]}
          onPress={() => {
            hapticMedium();
            toast.info('AI Insights — coming soon');
          }}
        >
          <Sparkles size={16} color={colors.textTertiary} style={{ marginRight: 6 }} />
          <Text style={[Typography.labelLarge, { color: colors.textTertiary }]}>
            AI Insight
          </Text>
          <Text style={[Typography.labelSmall, { color: colors.textTertiary, marginLeft: 4 }]}>
            · Coming soon
          </Text>
        </Pressable>
        <View style={styles.iconButtons}>
          <AnimatedPressable onPress={handleBookmark} style={[styles.iconButton, bookmarkAnimatedStyle]}>
            <Bookmark
              size={18}
              color={colors.textSecondary}
              fill={article.is_bookmarked ? colors.textSecondary : 'transparent'}
            />
          </AnimatedPressable>
        </View>
      </View>
    </AnimatedPressable>
  );
});

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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
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
  imagePlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
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
  aiInsightButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
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
