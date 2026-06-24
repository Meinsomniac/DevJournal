import { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';

export function useAnimatedPress(scaleTo = 0.97) {
  const pressed = useSharedValue(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale: pressed.value
          ? withTiming(scaleTo, { duration: 80 })
          : withTiming(1, { duration: 120 }),
      },
    ],
  }));

  const onPressIn = () => {
    pressed.value = true;
  };

  const onPressOut = () => {
    pressed.value = false;
  };

  return { animatedStyle, onPressIn, onPressOut };
}
