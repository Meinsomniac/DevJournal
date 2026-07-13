import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { View, StyleSheet, ScrollView, Text, Pressable, ActivityIndicator, Platform, Image, Animated as RNAnimated } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { toast } from 'sonner-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { useApp } from '@/context/AppContext';
import { useHaptics } from '@/hooks/useHaptics';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Article } from '@/types';
import { getArticleById, toggleBookmark, markRead } from '@/services/db';
import { getClassifyingIds, subscribe as subscribeClassificationIds } from '@/services/classificationStore';
import { formatDateTime } from '@/utils/date';
import { ImportanceStars, SourceIcon, BrokenImageIcon } from '@/components/ui';
import { Bookmark, ExternalLink } from 'lucide-react-native';
import { FEED_SOURCES } from '@/constants/Feeds';

const ICON_BY_NAME = new Map(FEED_SOURCES.map((s) => [s.name, s.icon]));
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, bumpDataVersion } = useApp();
  const { hapticMedium } = useHaptics();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const classifyingIds = useSyncExternalStore(subscribeClassificationIds, getClassifyingIds);
  const isClassifying = classifyingIds.has(id);

  const wasClassifying = useRef(false);

  useEffect(() => {
    const currentlyClassifying = classifyingIds.has(id);
    if (wasClassifying.current && !currentlyClassifying) {
      getArticleById(id).then((fresh) => {
        if (fresh) setArticle(fresh);
      });
    }
    wasClassifying.current = currentlyClassifying;
  }, [classifyingIds, id]);

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

  useEffect(() => {
    setImgError(false);
  }, [id]);

  const bookmarkScale = useSharedValue(1);
  const bookmarkRotation = useSharedValue(0);

  const bookmarkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: bookmarkScale.value },
      { rotate: `${interpolate(bookmarkRotation.value, [0, 1], [0, 10])}deg` },
    ],
  }));

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

    const wasBookmarked = article.is_bookmarked;
    hapticMedium();
    // eslint-disable-next-line react-hooks/immutability
    bookmarkScale.value = withSpring(1.3, { stiffness: 600, damping: 300 }, () => {
      bookmarkScale.value = withSpring(1, { stiffness: 600, damping: 300 });
    });
    // eslint-disable-next-line react-hooks/immutability
    bookmarkRotation.value = withTiming(1, { duration: 150 }, () => {
      bookmarkRotation.value = withTiming(0, { duration: 150 });
    });
    const newState = await toggleBookmark(article.id);
    setArticle({ ...article, is_bookmarked: newState });
    bumpDataVersion();
    toast.success(wasBookmarked ? 'Removed from bookmarks' : 'Saved to bookmarks');
  }, [article, hapticMedium, bumpDataVersion, bookmarkScale, bookmarkRotation]);

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
              <AnimatedPressable onPress={handleBookmark} style={[styles.headerIcon, bookmarkAnimatedStyle]}>
                <Bookmark
                  size={22}
                  color={article.is_bookmarked ? colors.warning : colors.textSecondary}
                  fill={article.is_bookmarked ? colors.warning : 'transparent'}
                />
              </AnimatedPressable>
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

        {article.image_uri && !imgError && article.nsfw_status !== 2 ? (
          isClassifying ? (
            <RNAnimated.View style={[styles.articleImage, { backgroundColor: colors.borderLight, opacity: pulseAnim }]} />
          ) : (
            <Image
              source={{ uri: article.image_uri }}
              style={[styles.articleImage, { backgroundColor: colors.borderLight }]}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          )
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.borderLight }]}>
            <BrokenImageIcon size={48} />
          </View>
        )}

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
  articleImage: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
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
