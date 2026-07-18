import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, Text, UIManager, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { Haptic, IOSFont } from '@/theme';
import { getMe } from '@/lib/me';
import { useAuth } from '@/state/auth';
import { readOnboardingDone, readOnboardingGender } from '@/state/onboarding';

// ─── Lottie module (optional native dep) ─────────────────────────────────
// lottie-react-native is bundled into the next EAS build but isn't in the
// current dev client. Require it dynamically so the missing native module
// doesn't crash the splash — we fall back to the letter animation below
// when LottieView is unavailable.
type LottieModule = {
  default: React.ComponentType<{
    source: unknown;
    autoPlay?: boolean;
    loop?: boolean;
    resizeMode?: 'cover' | 'contain' | 'center';
    style?: object;
    onAnimationFinish?: () => void;
  }>;
};
let LottieView: LottieModule['default'] | null = null;
let SPLASH_SOURCE: unknown = null;
// Probe for the *native* view manager — require()'ing the JS module always
// succeeds, but the native CALayer wrapper has to be linked into the host
// app. UIManager.hasViewManagerConfig returns false on the current dev
// client so we route to the letter-animation fallback instead of rendering
// the RN "Unimplemented component" placeholder.
const LOTTIE_NATIVE_READY =
  typeof UIManager.hasViewManagerConfig === 'function' &&
  UIManager.hasViewManagerConfig('LottieAnimationView');
if (LOTTIE_NATIVE_READY) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    LottieView = (require('lottie-react-native') as LottieModule).default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    SPLASH_SOURCE = require('../../assets/lottie/kiko-splash.json');
  } catch {
    LottieView = null;
  }
}

// Haptic timing — synced with kiko-splash Lottie frames 28/32/36/40 @60fps.
const HAPTIC_DELAYS_MS = [467, 533, 600, 667];

// Lottie 애니메이션이 끝난 뒤 마지막 프레임을 얼마나 더 붙잡아둘지.
// 애니메이션 자체가 ~1.2초라 유저 인지 전에 다음 화면으로 넘어가는 느낌 →
// 마지막 프레임에서 잠깐 머물러 브랜드를 각인시킨다.
const SPLASH_POST_HOLD_MS = 900;

// ─── Fallback letter animation ────────────────────────────────────────────
// Only used when lottie-react-native native module isn't linked. The main
// splash is the Lottie file bundled with the EAS build.
const LETTERS = ['k', 'i', 'k', 'o'] as const;
const STAGGER_MS = 130;
const RISE_MS = 500;
const HOLD_MS = 400;
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

// ─── Screen ──────────────────────────────────────────────────────────────

export default function SplashScreen() {
  const { status } = useAuth();
  const [animationDone, setAnimationDone] = useState(false);
  const navigatedRef = useRef(false);
  const useLottie = LottieView !== null && SPLASH_SOURCE !== null;

  // Lottie path: haptic punches synced to the timeline, plus a safety timer
  // that force-completes if `onAnimationFinish` never fires (bad JSON, native
  // module glitch, etc.). Without this the splash would hang forever.
  useEffect(() => {
    if (!useLottie) return;
    const timers = HAPTIC_DELAYS_MS.map((delay) =>
      setTimeout(Haptic.light, delay),
    );
    // Lottie animation is ~1.2s + post-hold; safety timer covers both plus
    // headroom in case onAnimationFinish never fires.
    const safety = setTimeout(
      () => setAnimationDone(true),
      3000 + SPLASH_POST_HOLD_MS,
    );
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(safety);
    };
  }, [useLottie]);

  // Fallback path: finish marker based on the letter-animation total length.
  useEffect(() => {
    if (useLottie) return;
    const total = LETTERS.length * STAGGER_MS + RISE_MS + HOLD_MS + EXIT_MS;
    const timer = setTimeout(() => setAnimationDone(true), total);
    return () => clearTimeout(timer);
  }, [useLottie]);

  useEffect(() => {
    if (!animationDone || status === 'loading' || navigatedRef.current) return;
    navigatedRef.current = true;
    // 온보딩 게이트.
    //  - 비로그인: 온보딩 미완료면 온보딩.
    //  - 로그인: 성별이 어디에도 없으면(로컬 온보딩 + 서버 프로필 모두 없음)
    //    온보딩으로 유도. 온보딩 이전에 가입한 기존 유저가 성별 없이 홈에
    //    들어가 큐레이션이 안 뜨는 문제를 막는다. 성별이 있으면 홈으로.
    void (async () => {
      if (status !== 'authenticated') {
        const onboarded = await readOnboardingDone();
        router.replace(onboarded ? '/home' : '/onboarding-lab');
        return;
      }
      // 로그인 유저 — 성별 보유 여부 확인 (로컬 우선, 없으면 서버 프로필).
      let hasGender = (await readOnboardingGender()) !== null;
      if (!hasGender) {
        try {
          const me = await getMe();
          hasGender = me.gender != null;
        } catch {
          // 프로필 조회 실패 — 홈으로 보내되 women 폴백이 큐레이션을 살린다.
          hasGender = true;
        }
      }
      router.replace(hasGender ? '/home' : '/onboarding-lab');
    })();
  }, [animationDone, status]);

  if (useLottie && LottieView) {
    return (
      <View style={[styles.root, styles.rootLight]}>
        <StatusBar barStyle="dark-content" />
        <LottieView
          source={SPLASH_SOURCE}
          autoPlay
          loop={false}
          resizeMode="contain"
          style={styles.lottie}
          onAnimationFinish={() => {
            // 마지막 프레임에서 잠깐 머무른 뒤에 다음 화면으로 넘어감.
            setTimeout(() => setAnimationDone(true), SPLASH_POST_HOLD_MS);
          }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, styles.rootDark]}>
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  rootLight: { backgroundColor: '#FFFFFF' },
  rootDark: { backgroundColor: '#000' },
  lottie: {
    width: '70%',
    aspectRatio: 9 / 16,
  },
  word: { flexDirection: 'row' },
  letter: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: IOSFont.sans,
    letterSpacing: -1.85,
  },
});
