import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { useAnimatedPress } from '@/hooks/useAnimatedPress';
import { Typography } from '@/constants/Typography';
import { BorderRadius, Spacing } from '@/constants/Spacing';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const { animatedStyle, onPressIn, onPressOut } = useAnimatedPress(variant === 'ghost' ? 0.97 : 0.95);

  const getBackgroundColor = () => {
    if (disabled) return colors.textTertiary;
    switch (variant) {
      case 'primary':
        return colors.brandPrimary;
      case 'secondary':
        return colors.brandSecondary;
      case 'outline':
      case 'ghost':
        return 'transparent';
      default:
        return colors.brandPrimary;
    }
  };

  const getTextColor = () => {
    if (disabled) return colors.textInverse;
    switch (variant) {
      case 'primary':
      case 'secondary':
        return colors.textInverse;
      case 'outline':
        return colors.brandPrimary;
      case 'ghost':
        return colors.textPrimary;
      default:
        return colors.textInverse;
    }
  };

  const sizeStyles = {
    small: { paddingVertical: Spacing.xs, paddingHorizontal: Spacing.md },
    medium: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg },
    large: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || loading}
      style={[
        animatedStyle,
        styles.button,
        sizeStyles[size],
        {
          backgroundColor: getBackgroundColor(),
          borderColor: variant === 'outline' ? colors.brandPrimary : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <>
          {icon}
          <Text
            style={[
              Typography.labelLarge,
              { color: getTextColor(), marginLeft: icon ? Spacing.xs : 0 },
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
  },
});
