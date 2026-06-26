import { useEffect } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Path, Rect, Svg } from 'react-native-svg';

const COLORS = {
  dark: { bg: '#0e0e11', d: '#85adad', j: '#36293d', text: '#6d6d78' },
  light: { bg: '#dbdbd7', d: '#333333', j: '#998466', text: '#666666' },
} as const;

const ICON_SIZE = 200;

interface AnimatedSplashScreenProps {
  onFinish: () => void;
}

export function AnimatedSplashScreen({ onFinish }: AnimatedSplashScreenProps) {
  const systemTheme = useColorScheme();
  const scheme = systemTheme === 'dark' ? 'dark' : 'light';
  const c = COLORS[scheme];

  const wipe = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const exitOpacity = useSharedValue(1);

  useEffect(() => {
    wipe.value = withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) });

    textOpacity.value = withDelay(900, withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }));

    const timer = setTimeout(() => {
      exitOpacity.value = withTiming(0, { duration: 350 }, (finished) => {
        if (finished) runOnJS(onFinish)();
      });
    }, 2400);

    return () => clearTimeout(timer);
  }, []);

  const exitStyle = useAnimatedStyle(() => ({ opacity: exitOpacity.value }));

  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: wipe.value * ICON_SIZE }],
  }));

  const textStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

  return (
    <Animated.View style={[styles.container, { backgroundColor: c.bg }, exitStyle]}>
      <View style={styles.iconWrapper}>
        <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 100 100">
          <Rect x="0" y="0" width="100" height="100" rx="24" fill="transparent" />
          <Path d="M28 28 L28 72 L43 72 Q60 72 60 50 Q60 28 43 28 Z" fill={c.d} />
          <Path d="M48 28 L72 72 L64 72 L40 28 Z" fill={c.j} />
        </Svg>

        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }, coverStyle]}
        />
      </View>

      <Animated.Text
        style={[
          { color: c.text, fontSize: 18, letterSpacing: 4, fontWeight: '700' },
          textStyle,
          styles.tagline,
        ]}
      >
        DEVJOURNAL
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapper: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    overflow: 'hidden',
  },
  tagline: {
    position: 'absolute',
    bottom: 120,
  },
});
