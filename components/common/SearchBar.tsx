import React, { useRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Search, X, SlidersHorizontal } from 'lucide-react-native';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing?: (text: string) => void;
  onClear?: () => void;
  onFilterPress?: () => void;
  filterActive?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  value,
  onChangeText,
  onSubmitEditing,
  onClear,
  onFilterPress,
  filterActive = false,
  placeholder = 'Search articles...',
  autoFocus = false,
}: SearchBarProps) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
    }
  }, [autoFocus]);

  const handleChangeText = useCallback((text: string) => {
    onChangeText(text);
  }, [onChangeText]);

  const handleClear = useCallback(() => {
    onChangeText('');
    onClear?.();
    inputRef.current?.focus();
  }, [onChangeText, onClear]);

  return (
    <View style={styles.container}>
      <View style={[styles.searchBox, { backgroundColor: colors.bgCard, borderColor: colors.borderLight }]}>
        <Search size={20} color={colors.textTertiary} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          value={value}
          onChangeText={handleChangeText}
          onSubmitEditing={() => onSubmitEditing?.(value)}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Pressable onPress={onFilterPress} style={styles.filterButton} accessibilityLabel="Open filters">
          <SlidersHorizontal size={20} color={filterActive ? colors.brandPrimary : colors.textTertiary} />
        </Pressable>
        {value.length > 0 && (
          <Pressable onPress={handleClear} style={styles.clearButton} accessibilityLabel="Clear search">
            <X size={20} color={colors.textTertiary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  filterButton: {
    padding: Spacing.xs,
  },
  clearButton: {
    padding: Spacing.xs,
  },
});