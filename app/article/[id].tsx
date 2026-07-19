import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react';
import { View, StyleSheet, ScrollView, Text, Pressable, ActivityIndicator, Platform, Animated as RNAnimated } from 'react-native';
import { Image } from 'expo-image';
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
import { getArticleById, toggleBookmark, markRead, updateArticleNsfwStatus, getSetting, setSetting } from '@/services/db';
import { InterstitialAd, AdEventType, BannerAdSize } from 'react-native-google-mobile-ads';
import { INTERSTITIAL_AD_UNIT_ID } from '@/components/common/AdBanner';
import AdBanner from '@/components/common/AdBanner';
import { getClassifyingIds, subscribe as subscribeClassificationIds } from '@/services/classificationStore';
import { classifyImage, isNSFWReady } from '@/services/nsfwDetector';
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
  const [localClassifying, setLocalClassifying] = useState(false);

  const classifyingIds = useSyncExternalStore(subscribeClassificationIds, getClassifyingIds);
  const isClassifying = localClassifying || classifyingIds.has(id);

  const wasClassifying = useRef(false);
  const countedThisMount = useRef(false);
  const pendingShowRef = useRef(false);

  const interstitialRef = useRef<InterstitialAd | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const loadInterstitial = useCallback(() => {
    cleanupRef.current?.();
    const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });
    const unsubscribeLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
      interstitialRef.current = ad;
      if (pendingShowRef.current) {
        pendingShowRef.current = false;
        ad.show();
      }
    });
    const unsubscribeError = ad.addAdEventListener(AdEventType.ERROR, () => {
      interstitialRef.current = null;
    });
    const unsubscribeClosed = ad.addAdEventListener(AdEventType.CLOSED, () => {
      interstitialRef.current = null;
      loadInterstitial();
    });
    cleanupRef.current = () => {
      unsubscribeLoaded();
      unsubscribeError();
      unsubscribeClosed();
    };
    ad.load();
  }, []);

  useEffect(() => {
    loadInterstitial();
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
      interstitialRef.current = null;
      pendingShowRef.current = false;
    };
  }, [loadInterstitial]);

  useEffect(() => {
    const currentlyClassifying = classifyingIds.has(id);
    if (wasClassifying.current && !currentlyClassifying) {
      getArticleById(id).then((fresh) => {
        if (fresh) setArticle(fresh);
      });
    }
    wasClassifying.current = currentlyClassifying;
  }, [classifyingIds, id]);

  // The feed only classifies visible items and never reports status to this
  // screen, so an unclassified article (nsfw_status === 0) would otherwise show
  // its image with no NSFW check. Classify it here and only reveal the image
  // once it is explicitly marked safe (nsfw_status === 1).
  useEffect(() => {
    if (!article || !article.image_uri || article.nsfw_status !== 0) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      if (cancelled) return;
      if (!isNSFWReady()) {
        timer = setTimeout(run, 500);
        return;
      }

      setLocalClassifying(true);
      let status = 1;
      try {
        const result = await classifyImage(article.image_uri!, article.title);
        status = result ? (result.isNSFW ? 2 : 1) : 1;
      } catch {
        status = 1; // mirror feed: don't hide on transient failures
      } finally {
        if (!cancelled) setLocalClassifying(false);
      }

      if (cancelled) return;
      await updateArticleNsfwStatus(article.id, status);
      const fresh = await getArticleById(article.id);
      if (!cancelled && fresh) setArticle(fresh);
    };

    run();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [article?.id, article?.image_uri, article?.nsfw_status]);

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

        // Count successful article-detail opens (once per mount) and show an
        // interstitial every 15th open.
        if (!countedThisMount.current) {
          countedThisMount.current = true;
          const count = await getSetting<number>('articleOpenCount', 0);
          const nextCount = count + 1;
          await setSetting('articleOpenCount', nextCount);
          if (nextCount % 15 === 0) {
            if (interstitialRef.current) {
              interstitialRef.current.show();
            } else {
              pendingShowRef.current = true;
            }
          }
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
    bookmarkScale.value = withSpring(1.3, { stiffness: 600, damping: 300 }, () => {
      bookmarkScale.value = withSpring(1, { stiffness: 600, damping: 300 });
    });
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

        {article.image_uri && !imgError && article.nsfw_status === 1 ? (
          <Image
            source={{ uri: article.image_uri }}
            style={[styles.articleImage, { backgroundColor: colors.borderLight }]}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
            onError={() => setImgError(true)}
          />
        ) : isClassifying ? (
          <RNAnimated.View style={[styles.imagePlaceholder, { backgroundColor: colors.borderLight, opacity: pulseAnim }]} />
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

      <View style={{backgroundColor: colors.bgPrimary}}>
        <AdBanner size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER} />
      </View>

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
