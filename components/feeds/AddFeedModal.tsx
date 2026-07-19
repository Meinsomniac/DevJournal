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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { toast } from 'sonner-native';
import ReAnimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { addCustomFeed, setFeedEnabled } from '@/services/db';
import {
  discoverRssFromUrl,
  validateRssUrl,
  DiscoveredFeed,
} from '@/services/feedDiscovery';
import { moderateFeed } from '@/services/contentModeration';
import { X, Plus, Globe, AlertTriangle } from 'lucide-react-native';

const AnimatedPressable = ReAnimated.createAnimatedComponent(Pressable);

// Extract the domain root from arbitrary input. Strips the scheme, then keeps
// only the host (with a trailing slash), discarding any path/query. If no valid
// host is found, returns the original input trimmed so the user can fix it.
function extractDomainRoot(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  let url: URL;
  try {
    url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return trimmed.replace(/^https?:\/\//i, '');
  }

  const host = url.hostname;
  if (!host) return trimmed.replace(/^https?:\/\//i, '');

  return `${host}/`;
}

interface AddFeedModalProps {
  visible: boolean;
  onClose: () => void;
  onFeedAdded: () => void;
  existingFeedUrls: Set<string>;
}

export function AddFeedModal({ visible, onClose, onFeedAdded, existingFeedUrls }: AddFeedModalProps) {
  const { colors } = useTheme();
  const [url, setUrl] = useState('');
  const [results, setResults] = useState<DiscoveredFeed[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [httpWarning, setHttpWarning] = useState(false);
  const [addingFeed, setAddingFeed] = useState<DiscoveredFeed | null>(null);
  const [customName, setCustomName] = useState('');
  const [customIcon, setCustomIcon] = useState('');
  const [checkingFeed, setCheckingFeed] = useState(false);
  const [verifyingUrl, setVerifyingUrl] = useState('');
  const [feedValid, setFeedValid] = useState<boolean | null>(null);
  const [moderationPassed, setModerationPassed] = useState(true);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const prevVisible = useRef(false);
  const feedReadyRef = useRef(false);

  const confirmScale = useSharedValue(0.8);
  const confirmOpacity = useSharedValue(0);

  // Reset state when modal opens
  useEffect(() => {
    if (visible && !prevVisible.current) {
      setUrl('');
      setResults([]);
      setLoading(false);
      setError('');
      setHttpWarning(false);
      setAddingFeed(null);
      setCustomName('');
      setCustomIcon('');
      setCheckingFeed(false);
      setVerifyingUrl('');
      setFeedValid(null);
      setModerationPassed(true);
      feedReadyRef.current = false;
    }
    prevVisible.current = visible;
  }, [visible]);

  const confirmAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: confirmScale.value }],
    opacity: confirmOpacity.value,
  }));

  function animateConfirmIn() {
    confirmScale.value = withTiming(1, { duration: 250 });
    confirmOpacity.value = withTiming(1, { duration: 200 });
  }

  const handleUrlChange = useCallback((text: string) => {
    setHttpWarning(/^http:\/\//i.test(text));
    // If the user pastes a full article URL, keep only the domain root
    // (e.g. "https://www.gizmochina.com/2026/07/12/post/" -> "www.gizmochina.com/")
    // so they don't have to trim the path themselves.
    const cleaned = extractDomainRoot(text);
    setUrl(cleaned);
    setAddingFeed(null);
    setError('');

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (cleaned.trim().length < 4) {
      setResults([]);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      setError('');

      discoverRssFromUrl(`https://${cleaned}`).then(discovered => {
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
    }, 600);
  }, [existingFeedUrls]);

  const handleSubmit = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const clean = url.replace(/^https?:\/\//i, '');
    if (!clean.trim()) return;

    setLoading(true);
    setError('');

    discoverRssFromUrl(`https://${clean}`).then(discovered => {
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
    setError('');
    feedReadyRef.current = false;
    setCheckingFeed(true);
    setVerifyingUrl(feed.rssUrl);
    setCustomIcon(feed.favicon);

    Promise.all([
      validateRssUrl(feed.rssUrl).then(valid => {
        setFeedValid(valid);
        return valid;
      }),
      moderateFeed(feed.rssUrl, feed.name).then(result => {
        setModerationPassed(result.allowed);
        return result;
      }),
    ]).then(([valid, moderation]) => {
      setCheckingFeed(false);
      setVerifyingUrl('');
      if (valid && moderation.allowed) {
        // Only open the dialog after verification succeeds.
        setAddingFeed(feed);
        setCustomName(feed.name.slice(0, 25));
        setModerationPassed(true);
        feedReadyRef.current = true;
        animateConfirmIn();
        toast.success('Feed validated and approved');
      } else if (!moderation.allowed) {
        setError('This feed contains content we don\'t allow. Please choose a different source.');
        toast.error('This feed contains content we don\'t allow.');
      } else {
        setError('Invalid RSS feed. Please try a different URL.');
        toast.error('Invalid RSS feed');
      }
    }).catch(() => {
      setCheckingFeed(false);
      setVerifyingUrl('');
      setError('Failed to verify feed. Please try again.');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirmAdd = useCallback(async () => {
    if (!addingFeed || checkingFeed) return;
    if (!feedValid) {
      setError('Invalid RSS feed. Please try a different URL.');
      return;
    }
    if (!moderationPassed) return;

    Keyboard.dismiss();
    setLoading(true);

    const name = (customName.trim() || addingFeed.name).slice(0, 25);
    const id = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now();

    await addCustomFeed({
      id,
      name,
      url: addingFeed.url,
      rss_url: addingFeed.rssUrl,
      icon: customIcon || addingFeed.favicon,
      added_at: Date.now(),
    });

    await setFeedEnabled(id, true);

    setLoading(false);
    setAddingFeed(null);
    setUrl('');
    setResults([]);
    toast.success('Feed added');
    onFeedAdded();
    onClose();
  }, [addingFeed, checkingFeed, feedValid, moderationPassed, customName, customIcon, onFeedAdded, onClose]);

  const handlePickIcon = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setCustomIcon(result.assets[0].uri);
    }
  }, []);

  const handleCancelAdd = useCallback(() => {
    setAddingFeed(null);
  }, []);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : "padding"}
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
              <Text style={[Typography.bodyMedium, { color: colors.textTertiary }]}>https://</Text>
              <TextInput
                ref={inputRef}
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="example.com"
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
                <TouchableOpacity onPress={() => { setUrl(''); setResults([]); setError(''); setHttpWarning(false); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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

            {/* HTTP Warning */}
            {httpWarning && (
              <View style={[styles.errorContainer, { backgroundColor: colors.warning + '15' }]}>
                <AlertTriangle size={14} color={colors.warning} />
                <Text style={[Typography.bodySmall, { color: colors.warning, marginLeft: Spacing.xs }]}>
                  Only HTTPS is supported. Using secure connection.
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
                <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {results.map((feed, index) => {
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
                        </View>
                        <TouchableOpacity
                          style={[styles.addButton, { backgroundColor: colors.brandPrimary }]}
                          onPress={() => handleAddFeed(feed)}
                          disabled={verifyingUrl === feed.rssUrl}
                        >
                          {verifyingUrl === feed.rssUrl ? (
                            <ActivityIndicator size={16} color={colors.textInverse} />
                          ) : (
                            <Plus size={16} color={colors.textInverse} />
                          )}
                        </TouchableOpacity>
                      </View>


                    </View>
                  );
                })}
              </ScrollView>
            )}

            {/* Confirm dialog */}
            <Modal transparent visible={!!addingFeed} animationType="none" onRequestClose={handleCancelAdd}>
              <Pressable style={styles.confirmBackdrop} onPress={handleCancelAdd}>
                <AnimatedPressable style={[styles.confirmDialog, { backgroundColor: colors.bgCard }, confirmAnimatedStyle]} onPress={e => e.stopPropagation()}>
                  {/* Icon picker */}
                  <TouchableOpacity onPress={handlePickIcon} style={styles.confirmIconPicker}>
                    <View style={[styles.confirmIconWrapper, { backgroundColor: colors.bgTertiary }]}>
                      {customIcon ? (
                        <Image source={{ uri: customIcon }} style={styles.confirmIconImage} />
                      ) : (
                        <Globe size={32} color={colors.textSecondary} />
                      )}
                    </View>
                    <Text style={[Typography.labelSmall, { color: colors.brandPrimary, marginTop: Spacing.xs }]}>
                      Change Icon
                    </Text>
                  </TouchableOpacity>

                  <Text style={[Typography.headlineSmall, { color: colors.textPrimary, textAlign: 'center', marginTop: Spacing.sm }]}>
                    Add Feed
                  </Text>

                  {addingFeed && (
                    <>
                      {/* Name input */}
                      <Text style={[Typography.labelMedium, { color: colors.textSecondary, alignSelf: 'flex-start', marginTop: Spacing.lg }]}>
                        Name
                      </Text>
                      <TextInput
                        style={[styles.confirmNameInput, { color: colors.textPrimary, backgroundColor: colors.bgTertiary, borderColor: colors.borderLight }]}
                        value={customName}
                        onChangeText={(text) => setCustomName(text.slice(0, 25))}
                        placeholder="Feed name"
                        placeholderTextColor={colors.textTertiary}
                        autoCorrect={false}
                        maxLength={25}
                      />

                      {/* URL display */}
                      <Text style={[Typography.labelMedium, { color: colors.textSecondary, alignSelf: 'flex-start', marginTop: Spacing.md }]}>
                        Feed URL
                      </Text>
                      <Text style={[Typography.bodySmall, { color: colors.textTertiary, alignSelf: 'flex-start', marginTop: Spacing.xs }]} numberOfLines={2}>
                        {addingFeed.rssUrl.replace(/^https?:\/\//, '')}
                      </Text>
                    </>
                  )}

                  {checkingFeed && (
                    <View style={[styles.loadingContainer, { marginTop: Spacing.md }]}>
                      <ActivityIndicator size="small" color={colors.brandPrimary} />
                      <Text style={[Typography.bodySmall, { color: colors.textTertiary, marginLeft: Spacing.sm }]}>
                        Verifying feed...
                      </Text>
                    </View>
                  )}

                  {!checkingFeed && error.length > 0 && (
                    <View style={[styles.errorContainer, { backgroundColor: colors.error + '10', marginTop: Spacing.md }]}>
                      <Text style={[Typography.bodySmall, { color: colors.error }]}>
                        {error}
                      </Text>
                    </View>
                  )}

                  <View style={styles.confirmActions}>
                    <TouchableOpacity onPress={handleCancelAdd} style={styles.cancelButton}>
                      <Text style={[Typography.labelMedium, { color: colors.textSecondary }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.confirmAddButton,
                        { backgroundColor: checkingFeed ? colors.borderMedium : colors.brandPrimary },
                      ]}
                      onPress={handleConfirmAdd}
                      disabled={checkingFeed}
                    >
                      <Text style={[Typography.labelMedium, { color: checkingFeed ? colors.textTertiary : colors.textInverse }]}>Add Feed</Text>
                    </TouchableOpacity>
                  </View>
                </AnimatedPressable>
              </Pressable>
            </Modal>

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
      </KeyboardAvoidingView>
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
    maxHeight: '80%',
    minHeight: 300,
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
    flexDirection: 'row',
    alignItems: 'center',
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
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmDialog: {
    width: '85%',
    padding: Spacing.xxl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  confirmIconPicker: {
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  confirmIconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  confirmIconImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  confirmNameInput: {
    width: '100%',
    fontSize: 16,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  confirmActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.xl,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  confirmAddButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxxl,
  },
});
