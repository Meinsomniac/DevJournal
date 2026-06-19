import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

interface ImportanceStarsProps {
  score: number;
  size?: number;
  color?: string;
}

export function ImportanceStars({ score, size = 12, color = '#FBBF24' }: ImportanceStarsProps) {
  const clampedScore = Math.max(1, Math.min(5, score));

  return (
    <View style={styles.container}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          size={size}
          color={color}
          fill={index < clampedScore ? color : 'transparent'}
          strokeWidth={1.5}
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
