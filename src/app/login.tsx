import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Haptic, IOSFont, IOSText } from '@/constants/ios';
import { SPLASH_IMAGES } from '@/constants/splashImages';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/state/auth';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID =
  (Constants.expoConfig?.extra?.googleClientId as string | undefined) ?? '';

const SLIDE_INTERVAL_MS = 3500;
const FADE_MS = 900;
const FIRST_SWITCH_MS = 1400;

function shuffled<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function BackgroundSlideshow() {
  const queue = useMemo(() => shuffled(SPLASH_IMAGES), []);
  const cursor = useRef(0);
  const [slotA, setSlotA] = useState(queue[0]);
  const [slotB, setSlotB] = useState(queue[1 % queue.length]);
  const showB = useSharedValue(0);
  const activeSlot = useRef<'A' | 'B'>('A');

  useEffect(() => {
    queue.forEach((uri) => Image.prefetch(uri));
  }, [queue]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = () => {
      if (cancelled) return;
      cursor.current = (cursor.current + 1) % queue.length;
      const nextUri = queue[(cursor.current + 1) % queue.length];
      if (activeSlot.current === 'A') {
        setSlotB(queue[cursor.current]);
        showB.value = withTiming(1, {
          duration: FADE_MS,
          easing: Easing.inOut(Easing.quad),
        });
        activeSlot.current = 'B';
      } else {
        setSlotA(queue[cursor.current]);
        showB.value = withTiming(0, {
          duration: FADE_MS,
          easing: Easing.inOut(Easing.quad),
        });
        activeSlot.current = 'A';
      }
      Image.prefetch(nextUri);
      timer = setTimeout(tick, SLIDE_INTERVAL_MS);
    };

    timer = setTimeout(tick, FIRST_SWITCH_MS);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [queue, showB]);

  const aStyle = useAnimatedStyle(() => ({ opacity: 1 - showB.value }));
  const bStyle = useAnimatedStyle(() => ({ opacity: showB.value }));

  return (
    <View style={styles.bg}>
      <Animated.View style={[StyleSheet.absoluteFill, aStyle]}>
        <Image source={slotA} style={styles.bgImage} contentFit="cover" transition={0} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, bStyle]}>
        <Image source={slotB} style={styles.bgImage} contentFit="cover" transition={0} />
      </Animated.View>
      <View style={[styles.veil, styles.veilTop]} />
      <View style={[styles.veil, styles.veilMid]} />
      <View style={[styles.veil, styles.veilBot]} />
    </View>
  );
}

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);

  const [, googleResponse, promptGoogle] = Google.useAuthRequest({
    iosClientId: GOOGLE_CLIENT_ID,
    webClientId: GOOGLE_CLIENT_ID,
  });

  const handleSignInSuccess = useCallback(() => {
    router.replace('/home');
  }, []);

  const handleSignInError = useCallback((err: unknown) => {
    if (err instanceof ApiError) {
      Alert.alert('로그인 실패', err.detail);
    } else {
      Alert.alert('로그인 실패', '잠시 후 다시 시도해주세요.');
    }
  }, []);

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type !== 'success') {
      setBusy(null);
      return;
    }
    const idToken = googleResponse.authentication?.idToken;
    if (!idToken) {
      setBusy(null);
      Alert.alert('로그인 실패', 'Google id_token을 받지 못했어요.');
      return;
    }
    (async () => {
      try {
        await signIn({ provider: 'google', id_token: idToken });
        handleSignInSuccess();
      } catch (err) {
        handleSignInError(err);
      } finally {
        setBusy(null);
      }
    })();
  }, [googleResponse, signIn, handleSignInSuccess, handleSignInError]);

  const onApple = useCallback(async () => {
    Haptic.medium();
    if (Platform.OS !== 'ios') {
      Alert.alert('Apple 로그인', 'iOS에서만 사용할 수 있어요.');
      return;
    }
    setBusy('apple');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error('No identity token from Apple');
      }
      await signIn({ provider: 'apple', id_token: credential.identityToken });
      handleSignInSuccess();
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === 'ERR_REQUEST_CANCELED') return;
      handleSignInError(err);
    } finally {
      setBusy(null);
    }
  }, [signIn, handleSignInSuccess, handleSignInError]);

  const onGoogle = useCallback(async () => {
    Haptic.medium();
    if (!GOOGLE_CLIENT_ID) {
      Alert.alert('Google 로그인', 'Google Client ID가 설정되어 있지 않아요.');
      return;
    }
    setBusy('google');
    try {
      await promptGoogle();
    } catch (err) {
      setBusy(null);
      handleSignInError(err);
    }
  }, [promptGoogle, handleSignInError]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />

      <BackgroundSlideshow />

      <SafeAreaView edges={['top']} style={styles.recWrap} pointerEvents="none">
        <View style={styles.recPill}>
          <View style={styles.recDot} />
          <Text style={styles.recText}>상품 이미지 영상 배경</Text>
        </View>
      </SafeAreaView>

      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        <View style={styles.copy}>
          <Text style={styles.headline}>
            머릿속에만 있던 그 옷,{'\n'}이제 꺼내 입으세요
          </Text>
          <Text style={styles.sub}>이미지 한 장으로 시작하는 패션 디깅</Text>
        </View>

        <View style={styles.actions}>
          <View style={styles.btnRow}>
            <Pressable
              accessibilityLabel="Apple로 계속하기"
              disabled={busy !== null}
              style={({ pressed }) => [
                styles.circ,
                pressed && styles.circPressed,
                busy === 'apple' && styles.circBusy,
              ]}
              onPress={onApple}
            >
              <SymbolView
                name="applelogo"
                size={24}
                tintColor="#FFFFFF"
                weight="medium"
              />
            </Pressable>

            <Pressable
              accessibilityLabel="Google로 계속하기"
              disabled={busy !== null}
              style={({ pressed }) => [
                styles.circ,
                pressed && styles.circPressed,
                busy === 'google' && styles.circBusy,
              ]}
              onPress={onGoogle}
            >
              <Text style={styles.googleG}>G</Text>
            </Pressable>
          </View>

          <Text style={styles.terms}>
            계속하면{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://kikoai.me/privacy')}
            >
              이용약관
            </Text>{' '}
            및{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL('https://kikoai.me/privacy')}
            >
              개인정보처리방침
            </Text>
            에 동의하는 것으로 간주됩니다.
          </Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

const CIRC = 64;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0B0B0C',
  },

  bg: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#0B0B0C',
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  veil: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  veilTop: {
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  veilMid: {
    top: '40%',
    backgroundColor: 'rgba(0,0,0,0.30)',
  },
  veilBot: {
    top: '70%',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },

  recWrap: {
    position: 'absolute',
    top: 0,
    right: 12,
    zIndex: 3,
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.34)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 9,
    marginTop: 4,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF5B5B',
  },
  recText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: IOSFont.rounded,
  },

  safe: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
    zIndex: 2,
  },
  copy: {
    marginTop: 64,
    alignItems: 'center',
  },
  headline: {
    fontSize: 32,
    lineHeight: 41,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: IOSFont.rounded,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  sub: {
    ...IOSText.callout,
    color: 'rgba(255,255,255,0.62)',
    fontFamily: IOSFont.rounded,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },

  actions: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 24,
  },
  circ: {
    width: CIRC,
    height: CIRC,
    borderRadius: CIRC / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.34)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circPressed: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  circBusy: {
    opacity: 0.5,
  },
  googleG: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: IOSFont.sans,
    lineHeight: 30,
  },
  terms: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: IOSFont.rounded,
  },
  termsLink: {
    color: 'rgba(255,255,255,0.82)',
    textDecorationLine: 'underline',
  },
});
