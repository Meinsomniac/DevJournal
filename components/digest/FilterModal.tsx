import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import {
  FilterState,
  DEFAULT_FILTER,
  FeedSource,
  ArticleCategory,
} from '@/types';
import { FEED_CATEGORIES } from '@/constants/Feeds';
import { SlidersHorizontal, Star, Check } from 'lucide-react-native';

interface FilterModalProps {
  visible: boolean;
  filters: FilterState;
  onApply: (filters: FilterState) => void;
  onClear: () => void;
  onClose: () => void;
  sources: FeedSource[];
}

const DATE_PRESETS = [
  { key: '24h' as const, label: 'Last 24 hours' },
  { key: '7d' as const, label: 'Last 7 days' },
  { key: '30d' as const, label: 'Last 30 days' },
  { key: null, label: 'All time' },
];

export function FilterModal({ visible, filters, onApply, onClear, onClose, sources }: FilterModalProps) {
  const { colors } = useTheme();
  const [localFilters, setLocalFilters] = useState<FilterState>(filters);
  const prevVisible = useRef(false);

  useEffect(() => {
    if (visible && !prevVisible.current) {
      setLocalFilters(filters);
    }
    prevVisible.current = visible;
  }, [visible, filters]);

  const toggleCategory = useCallback((cat: ArticleCategory) => {
    setLocalFilters(prev => {
      const exists = prev.categories.includes(cat);
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter(c => c !== cat)
          : [...prev.categories, cat],
      };
    });
  }, []);

  const toggleSource = useCallback((source: FeedSource) => {
    setLocalFilters(prev => {
      const exists = prev.sourceNames.includes(source.name);
      return {
        ...prev,
        sourceNames: exists
          ? prev.sourceNames.filter(n => n !== source.name)
          : [...prev.sourceNames, source.name],
      };
    });
  }, []);

  const setMinRating = useCallback((rating: number) => {
    setLocalFilters(prev => ({
      ...prev,
      minRating: prev.minRating === rating ? 0 : rating,
    }));
  }, []);

  const setDatePreset = useCallback((preset: '24h' | '7d' | '30d' | null) => {
    setLocalFilters(prev => ({
      ...prev,
      datePreset: prev.datePreset === preset ? null : preset,
    }));
  }, []);

  const handleClear = useCallback(() => {
    setLocalFilters(DEFAULT_FILTER);
    onClear();
  }, [onClear]);

  const handleApply = useCallback(() => {
    onApply(localFilters);
  }, [onApply, localFilters]);

  const activeGroupCount =
    (localFilters.categories.length > 0 ? 1 : 0) +
    (localFilters.sourceNames.length > 0 ? 1 : 0) +
    (localFilters.minRating > 0 ? 1 : 0) +
    (localFilters.datePreset !== null ? 1 : 0);

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

          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <SlidersHorizontal size={20} color={colors.textPrimary} />
              <Text style={[Typography.headlineMedium, { color: colors.textPrimary }]}>
                Filters
              </Text>
              {activeGroupCount > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.brandPrimary }]}>
                  <Text style={[Typography.labelSmall, { color: colors.textInverse }]}>
                    {activeGroupCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
            <Text style={[Typography.titleMedium, styles.sectionTitle, { color: colors.textSecondary }]}>
              Sort By
            </Text>
            <View style={styles.chipWrap}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: localFilters.sortOrder === 'newest' ? colors.brandPrimary + '20' : colors.bgTertiary,
                    borderColor: localFilters.sortOrder === 'newest' ? colors.brandPrimary : colors.borderLight,
                  },
                ]}
                onPress={() => setLocalFilters(prev => ({ ...prev, sortOrder: 'newest' }))}
              >
                <Text style={[
                  Typography.labelMedium,
                  { color: localFilters.sortOrder === 'newest' ? colors.brandPrimary : colors.textSecondary },
                ]}>
                  Newest
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.chip,
                  {
                    backgroundColor: localFilters.sortOrder === 'oldest' ? colors.brandPrimary + '20' : colors.bgTertiary,
                    borderColor: localFilters.sortOrder === 'oldest' ? colors.brandPrimary : colors.borderLight,
                  },
                ]}
                onPress={() => setLocalFilters(prev => ({ ...prev, sortOrder: 'oldest' }))}
              >
                <Text style={[
                  Typography.labelMedium,
                  { color: localFilters.sortOrder === 'oldest' ? colors.brandPrimary : colors.textSecondary },
                ]}>
                  Oldest
                </Text>
              </TouchableOpacity>
            </View>
            
            <Text style={[Typography.titleMedium, styles.sectionTitle, { color: colors.textSecondary }]}>
              Date
            </Text>
            <View style={styles.chipWrap}>
              {DATE_PRESETS.map(preset => {
                const selected = localFilters.datePreset === preset.key;
                return (
                  <TouchableOpacity
                    key={preset.key ?? 'all'}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? colors.brandPrimary + '20' : colors.bgTertiary,
                        borderColor: selected ? colors.brandPrimary : colors.borderLight,
                      },
                    ]}
                    onPress={() => setDatePreset(preset.key)}
                  >
                    <Text style={[
                      Typography.labelMedium,
                      { color: selected ? colors.brandPrimary : colors.textSecondary },
                    ]}>
                      {preset.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[Typography.titleMedium, styles.sectionTitle, { color: colors.textSecondary }]}>
              Minimum Importance
            </Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map(rating => {
                const selected = localFilters.minRating > 0 && rating <= localFilters.minRating;
                return (
                  <TouchableOpacity
                    key={rating}
                    style={[
                      styles.starButton,
                      {
                        backgroundColor: selected ? colors.warning + '20' : colors.bgTertiary,
                        borderColor: selected ? colors.warning : colors.borderLight,
                      },
                    ]}
                    onPress={() => setMinRating(rating)}
                  >
                    <Star
                      size={18}
                      color={selected ? colors.warning : colors.textTertiary}
                      fill={selected ? colors.warning : 'transparent'}
                      strokeWidth={1.5}
                    />
                  </TouchableOpacity>
                );
              })}
              {localFilters.minRating > 0 && (
                <View style={styles.minRatingLabel}>
                  <Text style={[Typography.labelSmall, { color: colors.warning }]}>
                    {localFilters.minRating}+
                  </Text>
                </View>
              )}
            </View>

            <Text style={[Typography.titleMedium, styles.sectionTitle, { color: colors.textSecondary }]}>
              Category
            </Text>
            <View style={styles.chipWrap}>
              {FEED_CATEGORIES.map(({ key, label }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: localFilters.categories.includes(key as ArticleCategory)
                        ? colors.brandPrimary + '20'
                        : colors.bgTertiary,
                      borderColor: localFilters.categories.includes(key as ArticleCategory)
                        ? colors.brandPrimary
                        : colors.borderLight,
                    },
                  ]}
                  onPress={() => toggleCategory(key as ArticleCategory)}
                >
                  <Text
                    style={[
                      Typography.labelMedium,
                      {
                        color: localFilters.categories.includes(key as ArticleCategory)
                          ? colors.brandPrimary
                          : colors.textSecondary,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[Typography.titleMedium, styles.sectionTitle, { color: colors.textSecondary }]}>
              Source
            </Text>
            {sources.map(source => {
              const selected = localFilters.sourceNames.includes(source.name);
              return (
                <TouchableOpacity
                  key={source.id}
                  style={[
                    styles.checkRow,
                    { borderColor: selected ? colors.brandPrimary : colors.borderLight },
                  ]}
                  onPress={() => toggleSource(source)}
                >
                  <View style={[
                    styles.checkbox,
                    {
                      backgroundColor: selected ? colors.brandPrimary : 'transparent',
                      borderColor: selected ? colors.brandPrimary : colors.borderMedium,
                    },
                  ]}>
                    {selected && <Check size={14} color={colors.textInverse} strokeWidth={3} />}
                  </View>
                  <Text style={[Typography.bodyMedium, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
                    {source.name}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <View style={{ height: Spacing.xxxl + 60 }} />
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.borderLight }]}>
            <TouchableOpacity
              style={[styles.clearButton, { borderColor: colors.borderMedium }]}
              onPress={handleClear}
            >
              <Text style={[Typography.labelMedium, { color: colors.textSecondary }]}>
                Clear
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, { backgroundColor: colors.brandPrimary }]}
              onPress={handleApply}
            >
              <Text style={[Typography.labelMedium, { color: colors.textInverse }]}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
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
    maxHeight: '80%',
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  scrollArea: {
    flexGrow: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.chip,
    borderWidth: 1,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: BorderRadius.xs,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  starButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minWidth: 48,
  },
  minRatingLabel: {
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    marginTop: Spacing.md,
  },
  clearButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  applyButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
});
