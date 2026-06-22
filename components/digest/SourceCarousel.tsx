import React, { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { FeedSource } from '@/types';
import { useTheme } from '@/hooks/useTheme';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { Globe } from 'lucide-react-native';

const ITEM_WIDTH = 120;

interface CarouselItemData {
  key: 'all' | string;
  name: string;
  iconUri: string | null;
  sourceId?: string;
}

interface SourceCarouselProps {
  sources: FeedSource[];
  selectedSource: string;
  onSourceChange: (sourceId: string) => void;
}

const CarouselItem = React.memo(function CarouselItem({
  item,
  isSelected,
  onPress,
}: {
  item: CarouselItemData;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const [imgError, setImgError] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.item,
        {
          backgroundColor: isSelected ? colors.brandPrimary + '18' : colors.bgCard,
          borderColor: isSelected ? colors.brandPrimary : colors.borderLight,
        },
      ]}
    >
      {item.key === 'all' ? (
        <Globe size={32} color={isSelected ? colors.brandPrimary : colors.textSecondary} />
      ) : item.iconUri && !imgError ? (
        <Image
          source={{ uri: item.iconUri }}
          style={styles.icon}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={[styles.fallbackIcon, { backgroundColor: isSelected ? colors.brandPrimary + '18' : colors.borderLight }]}>
          <Text style={[styles.fallbackLetter, { color: colors.textSecondary, fontSize: 16 }]}>
            {item.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <Text
        style={[
          styles.label,
          { color: isSelected ? colors.brandPrimary : colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {item.name}
      </Text>
    </Pressable>
  );
});

function buildCarouselItems(sources: FeedSource[]): CarouselItemData[] {
  return [
    { key: 'all', name: 'All', iconUri: null },
    ...sources.map((s) => ({
      key: s.id,
      name: s.name,
      iconUri: s.icon ?? null,
      sourceId: s.id,
    })),
  ];
}

export function SourceCarousel({ sources, selectedSource, onSourceChange }: SourceCarouselProps) {
  const { width: screenWidth } = useWindowDimensions();
  const listRef = useRef<FlatList<CarouselItemData>>(null);

  const items = useMemo(() => buildCarouselItems(sources), [sources]);

  const sidePadding = (screenWidth - ITEM_WIDTH) / 2;

  const getItemLayout = useCallback(
    (_data: ArrayLike<CarouselItemData> | null | undefined, index: number) => ({
      length: ITEM_WIDTH,
      offset: ITEM_WIDTH * index,
      index,
    }),
    []
  );

  const selectedIndex = useMemo(
    () => items.findIndex((item) => item.key === selectedSource),
    [items, selectedSource]
  );

  useEffect(() => {
    if (selectedIndex < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: selectedIndex * ITEM_WIDTH, animated: true });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedIndex]);

  const handlePress = useCallback(
    (index: number) => {
      listRef.current?.scrollToOffset({ offset: index * ITEM_WIDTH, animated: true });
      const item = items[index];
      if (item) {
        onSourceChange(item.key);
      }
    },
    [items, onSourceChange]
  );

  const handleMomentumEnd = useCallback(
    (event: { nativeEvent: { contentOffset: { x: number } } }) => {
      const index = Math.round(event.nativeEvent.contentOffset.x / ITEM_WIDTH);
      const item = items[index];
      if (item && item.key !== selectedSource) {
        onSourceChange(item.key);
      }
    },
    [items, onSourceChange, selectedSource]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: CarouselItemData; index: number }) => (
      <CarouselItem
        item={item}
        isSelected={item.key === selectedSource}
        onPress={() => handlePress(index)}
      />
    ),
    [selectedSource, handlePress]
  );

  const keyExtractor = useCallback((item: CarouselItemData) => item.key, []);

  if (sources.length === 0) return null;

  return (
    <View style={styles.wrapper}>
      <FlatList
        ref={listRef}
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        contentContainerStyle={{ paddingHorizontal: sidePadding }}
        snapToInterval={ITEM_WIDTH}
        snapToAlignment="start"
        decelerationRate="fast"
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={3}
        onMomentumScrollEnd={handleMomentumEnd}
        scrollEnabled={items.length > 1}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  item: {
    width: ITEM_WIDTH,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginHorizontal: 4,
    padding: Spacing.sm,
  },
  label: {
    ...Typography.labelSmall,
    textAlign: 'center',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  fallbackIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackLetter: {
    fontWeight: '700',
  },
});