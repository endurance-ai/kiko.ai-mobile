import { router } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Haptic, IOSFont } from '@/constants/ios';

const LETTERS = ['k', 'i', 'k', 'o'] as const;
// 4 letters × 100ms stagger + 400ms rise → last letter lands at ~700ms.
const STAGGER_MS = 100;
const RISE_MS = 400;
const HOLD_MS = 350;
const EXIT_MS = 600;

function Letter({ char, delay }: { char: string; delay: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.cubic) }),
    );
    const hapticTimer = setTimeout(Haptic.light, delay);
    return () => clearTimeout(hapticTimer);
  }, [delay, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 22 }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Text style={styles.letter}>{char}</Text>
    </Animated.View>
  );
}

export default function SplashScreen() {
  useEffect(() => {
    const total = LETTERS.length * STAGGER_MS + RISE_MS + HOLD_MS + EXIT_MS;
    const timer = setTimeout(() => {
      router.replace('/login');
    }, total);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.word}>
        {LETTERS.map((char, i) => (
          <Letter key={i} char={char} delay={i * STAGGER_MS} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  word: {
    flexDirection: 'row',
  },
  letter: {
    fontSize: 56,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: IOSFont.rounded,
    letterSpacing: -2,
  },
});
