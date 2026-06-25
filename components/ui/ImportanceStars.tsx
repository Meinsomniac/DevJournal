import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withRepeat, withDelay } from 'react-native-reanimated';
import { Star } from 'lucide-react-native';

interface ImportanceStarsProps {
  score: number;
  size?: number;
  color?: string;
  animate?: boolean;
}

const STAGGER_MS = 100;
const SCALE_UP_MS = 200;
const SCALE_DOWN_MS = 200;

function AnimatedStar({ index, size, color, fill, animate }: {
  index: number;
  size: number;
  color: string;
  fill: string;
  animate: boolean;
}) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (animate) {
      const holdDuration = 4 * STAGGER_MS;

      scale.value = withDelay(
        index * STAGGER_MS,
        withRepeat(
          withSequence(
            withTiming(1.5, { duration: SCALE_UP_MS }),
            withTiming(1, { duration: SCALE_DOWN_MS }),
            withTiming(1, { duration: holdDuration })
          ),
          -1,
          false
        )
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [animate, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[animatedStyle, { marginHorizontal: 1 }]}>
      <Star size={size} color={color} fill={fill} strokeWidth={1.5} />
    </Animated.View>
  );
}

export function ImportanceStars({ score, size = 12, color = '#FBBF24', animate = false }: ImportanceStarsProps) {
  const clampedScore = Math.max(1, Math.min(5, score));

  return (
    <View style={styles.container}>
      {Array.from({ length: 5 }).map((_, index) => (
        <AnimatedStar
          key={index}
          index={index}
          size={size}
          color={color}
          fill={index < clampedScore ? color : 'transparent'}
          animate={animate}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 2,
  },
});
