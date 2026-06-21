import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { ArticleCategory } from '@/types';
import { addCustomFeed, setFeedEnabled } from '@/services/db';
import {
  discoverRssFromUrl,
  validateRssUrl,
  DiscoveredFeed,
} from '@/services/feedDiscovery';
import { X, Plus, Globe, Link as LinkIcon } from 'lucide-react-native';

interface AddFeedModalProps {
  visible: boolean;
  onClose: () => void;
  onFeedAdded: () => void;
  existingFeedUrls: Set<string>;
}

const CATEGORY_COLORS: Record<ArticleCategory, string> = {
  AI: '#8B5CF6',
  Frontend: '#61DAFB',
  Backend: '#10B981',
  Infrastructure: '#F59E0B',
  Security: '#EF4444',
  Career: '#EC4899',
  Tools: '#6366F1',
  General: '#94A3B8',
};

export function AddFeedModal({ visible, onClose, onFeedAdded, existingFeedUrls }: AddFeedModalProps) {
  const { colors } = useTheme();
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<DiscoveredFeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [addingFeed, setAddingFeed] = useState<DiscoveredFeed | null>(null);
  const [confirmCategory, setConfirmCategory] = useState<ArticleCategory>('General');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const prevVisible = useRef(false);

  // Reset state when modal opens
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setUrl('');
      setResults([]);
      setLoading(false);
      setError('');
      setAddingFeed(null);
      setShowCategoryPicker(false);
    }
    prevVisible.current = visible;
  }, [visible]);

  const handleUrlChange = useCallback((text: string) => {
    setUrl(text);
    setAddingFeed(null);
    setShowCategoryPicker(false);
    setError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (text.trim().length < 4) {
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError('');

      discoverRssFromUrl(text).then(discovered => {
        const filtered = discovered.filter(f => !existingFeedUrls.has(f.rssUrl));
        console.log({filtered})
        setResults(filtered);
        setLoading(false);
        if (filtered.length === 0) {
          setError('No RSS feeds found at this URL. Try the homepage URL.');
        }
      }).catch(() => {
        setLoading(false);
        setError('Failed to fetch URL. Please check and try again.');
      });
    }, 600);
  }, [existingFeedUrls]);

  const handleSubmit = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!url.trim()) return;

    setLoading(true);
    setError('');

    discoverRssFromUrl(url).then(discovered => {
      const filtered = discovered.filter(f => !existingFeedUrls.has(f.rssUrl));
      setResults(filtered);
      setLoading(false);
      if (filtered.length === 0) {
        setError('No RSS feeds found at this URL. Try the homepage URL.');
      }
    }).catch(() => {
      setLoading(false);
      setError('Failed to fetch URL. Please check and try again.');
    });
  }, [url, existingFeedUrls]);

  const handleAddFeed = useCallback((feed: DiscoveredFeed) => {
    setAddingFeed(feed);
    setConfirmCategory(feed.category);
    setShowCategoryPicker(true);
  }, []);

  const handleConfirmAdd = useCallback(async () => {
    if (!addingFeed) return;

    Keyboard.dismiss();
    setLoading(true);

    const isValid = await validateRssUrl(addingFeed.rssUrl);
    if (!isValid) {
      setLoading(false);
      setError('Invalid RSS feed. Please try a different URL.');
      setAddingFeed(null);
      setShowCategoryPicker(false);
      return;
    }

    const id = addingFeed.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();

    await addCustomFeed({
      id,
      name: addingFeed.name,
      url: addingFeed.url,
      rss_url: addingFeed.rssUrl,
      category: confirmCategory,
      icon: addingFeed.favicon,
      added_at: Date.now(),
    });

    await setFeedEnabled(id, true);

    setLoading(false);
    setAddingFeed(null);
    setShowCategoryPicker(false);
    setUrl('');
    setResults([]);
    onFeedAdded();
    onClose();
  }, [addingFeed, confirmCategory, onFeedAdded, onClose]);

  const handleCancelAdd = useCallback(() => {
    setAddingFeed(null);
    setShowCategoryPicker(false);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.bgPrimary }]} onPress={e => e.stopPropagation()}>
          <View style={styles.handleContainer}>
            <View style={[styles.handle, { backgroundColor: colors.borderMedium }]} />
          </View>

          <Text style={[Typography.headlineMedium, { color: colors.textPrimary, marginBottom: Spacing.lg }]}>
            Add Custom Feed
          </Text>

          {/* URL Input */}
          <View style={[styles.searchContainer, { backgroundColor: colors.bgTertiary, borderColor: colors.borderLight }]}>
            <LinkIcon size={18} color={colors.textTertiary} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: colors.textPrimary }]}
              placeholder="Paste a website URL..."
              placeholderTextColor={colors.textTertiary}
              value={url}
              onChangeText={handleUrlChange}
              onSubmitEditing={handleSubmit}
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType="url"
              returnKeyType="search"
            />
            {url.length > 0 && (
              <TouchableOpacity onPress={() => { setUrl(''); setResults([]); setError(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color={colors.textTertiary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Loading */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.brandPrimary} />
              <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginLeft: Spacing.sm }]}>
                Discovering feeds...
              </Text>
            </View>
          )}

          {/* Error */}
          {!loading && error.length > 0 && (
            <View style={[styles.errorContainer, { backgroundColor: colors.error + '10' }]}>
              <Text style={[Typography.bodySmall, { color: colors.error }]}>
                {error}
              </Text>
            </View>
          )}

          {/* Results */}
          {results.length > 0 && (
            <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
              {results.map((feed, index) => {
                const isAdding = addingFeed?.rssUrl === feed.rssUrl && showCategoryPicker;

                return (
                  <View key={`${feed.rssUrl}-${index}`}>
                    <View style={[styles.resultCard, { backgroundColor: colors.bgCard, borderColor: colors.borderLight }]}>
                      <View style={[styles.iconCircle, { backgroundColor: colors.bgTertiary }]}>
                        <Globe size={20} color={colors.textSecondary} />
                      </View>
                      <View style={styles.resultInfo}>
                        <Text style={[Typography.titleSmall, { color: colors.textPrimary }]} numberOfLines={1}>
                          {feed.name}
                        </Text>
                        <Text style={[Typography.labelSmall, { color: colors.textTertiary }]} numberOfLines={1}>
                          {feed.rssUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                        </Text>
                        <View style={[styles.categoryBadge, { backgroundColor: CATEGORY_COLORS[feed.category] + '20' }]}>
                          <Text style={[Typography.labelSmall, { color: CATEGORY_COLORS[feed.category] }]}>
                            {feed.category}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: colors.brandPrimary }]}
                        onPress={() => handleAddFeed(feed)}
                      >
                        <Plus size={16} color={colors.textInverse} />
                      </TouchableOpacity>
                    </View>

                    {/* Category picker (inline) */}
                    {isAdding && (
                      <View style={[styles.categoryPicker, { backgroundColor: colors.bgTertiary }]}>
                        <Text style={[Typography.labelMedium, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
                          Category:
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                          {(Object.keys(CATEGORY_COLORS) as ArticleCategory[]).map(cat => (
                            <TouchableOpacity
                              key={cat}
                              style={[
                                styles.categoryOption,
                                {
                                  backgroundColor: confirmCategory === cat
                                    ? CATEGORY_COLORS[cat] + '30'
                                    : colors.bgCard,
                                  borderColor: confirmCategory === cat
                                    ? CATEGORY_COLORS[cat]
                                    : colors.borderLight,
                                },
                              ]}
                              onPress={() => setConfirmCategory(cat)}
                            >
                              <Text style={[
                                Typography.labelSmall,
                                { color: confirmCategory === cat ? CATEGORY_COLORS[cat] : colors.textSecondary },
                              ]}>
                                {cat}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                        <View style={styles.confirmActions}>
                          <TouchableOpacity onPress={handleCancelAdd} style={styles.cancelButton}>
                            <Text style={[Typography.labelMedium, { color: colors.textSecondary }]}>Cancel</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.confirmButton, { backgroundColor: colors.brandPrimary }]}
                            onPress={handleConfirmAdd}
                          >
                            <Text style={[Typography.labelMedium, { color: colors.textInverse }]}>Confirm</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Empty state */}
          {!loading && results.length === 0 && !error && url.length >= 4 && (
            <View style={styles.emptyState}>
              <Globe size={32} color={colors.textTertiary} />
              <Text style={[Typography.bodyMedium, { color: colors.textSecondary, marginTop: Spacing.md }]}>
                Enter a website URL to discover its RSS feeds
              </Text>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
    maxHeight: '60%',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.xs,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    justifyContent: 'center',
  },
  errorContainer: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  resultsContainer: {
    flexGrow: 1,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.xs,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryPicker: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    marginLeft: Spacing.md + 40 + Spacing.md,
  },
  categoryScroll: {
    marginBottom: Spacing.sm,
  },
  categoryOption: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
    marginRight: Spacing.xs,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  cancelButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  confirmButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
});
