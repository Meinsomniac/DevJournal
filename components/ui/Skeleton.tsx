import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Animated, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { BorderRadius } from '@/constants/Spacing';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = BorderRadius.xs, style }: SkeletonProps) {
  const { colors, isDark } = useTheme();
  const [animatedValue] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() =>
    animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.3, 0.7],
    })
  );

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  return (
    <Animated.View
      style={[
        {
          height,
          borderRadius,
          backgroundColor: isDark ? colors.bgTertiary : colors.borderLight,
          opacity,
        },
        typeof width === 'string' ? null : { width },
        style,
      ]}
    />
  );
}

export function ArticleSkeleton() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard }]}>
      <View style={styles.header}>
        <Skeleton width={100} height={12} />
        <Skeleton width={60} height={20} borderRadius={10} />
      </View>
      <Skeleton width="90%" height={20} style={{ marginTop: 8 }} />
      <Skeleton width="60%" height={20} style={{ marginTop: 4 }} />
      <View style={styles.footer}>
        <Skeleton width={80} height={12} />
        <Skeleton width={60} height={12} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: BorderRadius.md,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
});
