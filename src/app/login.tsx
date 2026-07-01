import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Easing,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TextStyle,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { Haptic } from '@/constants/ios';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/state/auth';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID =
  (Constants.expoConfig?.extra?.googleClientId as string | undefined) ?? '';

// ─── LinearGradient module (optional native dep) ─────────────────────────
// expo-linear-gradient is bundled in the next EAS build but not in the
// current dev client. Guard the require so the missing native module
// doesn't crash login — we fall back to a stacked-View band gradient.
type LinearGradientModule = {
  LinearGradient: React.ComponentType<{
    colors: readonly string[];
    locations?: readonly number[];
    style?: object;
    start?: { x: number; y: number };
    end?: { x: number; y: number };
  }>;
};
let LinearGradient: LinearGradientModule['LinearGradient'] | null = null;
// Probe the native view manager — require() always succeeds because the JS
// module is pure, but the underlying CAGradientLayer wrapper has to be
// linked into the host. Dev client without the rebuild won't have it.
const LINEAR_GRADIENT_NATIVE_READY =
  typeof UIManager.hasViewManagerConfig === 'function' &&
  // expo-linear-gradient registers under 'BVLinearGradient' (the original
  // react-native-linear-gradient view name) — same on iOS and Android.
  UIManager.hasViewManagerConfig('BVLinearGradient');
if (LINEAR_GRADIENT_NATIVE_READY) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    LinearGradient = (require('expo-linear-gradient') as LinearGradientModule)
      .LinearGradient;
  } catch {
    LinearGradient = null;
  }
}

const GRADIENT_STOPS = [
  { color: '#fefcfa', at: 0 },
  { color: '#fefcfa', at: 0.32 },
  { color: '#fce4d2', at: 0.65 },
  { color: '#f5cdb6', at: 0.88 },
  { color: '#eebda5', at: 1 },
] as const;

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [
    parseInt(m.slice(0, 2), 16),
    parseInt(m.slice(2, 4), 16),
    parseInt(m.slice(4, 6), 16),
  ];
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function colorAt(t: number): string {
  for (let i = 1; i < GRADIENT_STOPS.length; i++) {
    const prev = GRADIENT_STOPS[i - 1];
    const next = GRADIENT_STOPS[i];
    if (t <= next.at) {
      const span = next.at - prev.at || 1;
      const k = (t - prev.at) / span;
      const [r1, g1, b1] = hexToRgb(prev.color);
      const [r2, g2, b2] = hexToRgb(next.color);
      const r = Math.round(lerp(r1, r2, k));
      const g = Math.round(lerp(g1, g2, k));
      const b = Math.round(lerp(b1, b2, k));
      return `rgb(${r},${g},${b})`;
    }
  }
  return GRADIENT_STOPS[GRADIENT_STOPS.length - 1].color;
}

const BAND_PX = 4; // Integer logical px, sub-pixel rounding-safe.
const FALLBACK_BANDS = Math.ceil(Dimensions.get('window').height / BAND_PX);

/** Either native LinearGradient or stacked-View bands fallback. */
function BackgroundGradient() {
  if (LinearGradient) {
    return (
      <LinearGradient
        colors={GRADIENT_STOPS.map((s) => s.color)}
        locations={GRADIENT_STOPS.map((s) => s.at)}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: FALLBACK_BANDS }).map((_, i) => (
        <View
          key={i}
          style={{
            height: BAND_PX,
            backgroundColor: colorAt(i / (FALLBACK_BANDS - 1)),
          }}
        />
      ))}
    </View>
  );
}

const SCREEN_W = Dimensions.get('window').width;

// ─── Brand marquee data ──────────────────────────────────────────────────
// Each row scrolls in alternating directions. Per-chip style overrides
// approximate the brand wordmarks with system fonts (Inter / serif italic /
// etc. need an expo-font bundle for full fidelity — wired without them
// here so the screen ships before that follow-up).
type ChipStyle = {
  weight?: TextStyle['fontWeight'];
  italic?: boolean;
  serif?: boolean;
  upper?: boolean;
  lower?: boolean;
  size?: number;
  letterSpacing?: number;
};

type Chip = {
  label: string;
  s: ChipStyle;
};

const ROW_1: Chip[] = [
  { label: 'MATIN KIM', s: { weight: '700', upper: true, size: 12.5, letterSpacing: 0.75 } },
  { label: 'Mardi Mercredi', s: { italic: true, serif: true, weight: '500', size: 18, letterSpacing: -0.18 } },
  { label: 'LOW CLASSIC', s: { weight: '500', upper: true, size: 11, letterSpacing: 1.32 } },
  { label: 'Sienne', s: { italic: true, serif: true, weight: '400', size: 18 } },
  { label: 'pottery', s: { weight: '500', lower: true, size: 14, letterSpacing: 0.56 } },
  { label: 'instantfunk', s: { weight: '800', lower: true, size: 14 } },
  { label: 'Kindersalmon', s: { weight: '700', size: 13 } },
];

const ROW_2: Chip[] = [
  { label: 'ADER error', s: { weight: '700', lower: true, size: 15 } },
  { label: 'ANDERSSON BELL', s: { weight: '600', upper: true, size: 11.5, letterSpacing: 0.69 } },
  { label: 'we11done', s: { weight: '700', lower: true, size: 14, letterSpacing: 0.56 } },
  { label: 'Stüssy', s: { italic: true, serif: true, weight: '500', size: 19 } },
  { label: 'PLASTICPRODUCT', s: { weight: '600', upper: true, size: 11.5, letterSpacing: 0.92 } },
  { label: 'twojeys', s: { weight: '800', lower: true, size: 16, letterSpacing: -0.4 } },
  { label: 'ZARA', s: { serif: true, weight: '700', upper: true, size: 14.5, letterSpacing: 0.58 } },
];

const ROW_3: Chip[] = [
  { label: 'RECTO', s: { weight: '700', upper: true, size: 13, letterSpacing: 1.04 } },
  { label: 'WALES BONNER', s: { weight: '800', upper: true, size: 11.5, letterSpacing: 1.61 } },
  { label: 'Bode', s: { italic: true, serif: true, weight: '500', size: 19 } },
  { label: 'KITH', s: { weight: '800', upper: true, size: 14, letterSpacing: 0.56 } },
  { label: 'Noah', s: { italic: true, serif: true, weight: '400', size: 19 } },
  { label: 'AIMÉ LEON DORE', s: { weight: '700', upper: true, size: 11, letterSpacing: 1.98 } },
  { label: 'AWAKE NY', s: { weight: '800', upper: true, size: 12, letterSpacing: 1.2 } },
];

// ─── Marquee row ────────────────────────────────────────────────────────

function MarqueeRow({
  chips,
  direction,
  durationMs,
}: {
  chips: Chip[];
  direction: 'left' | 'right';
  durationMs: number;
}) {
  // Each row renders the chip list twice back-to-back so we can translate
  // by exactly -W (one copy) for a seamless loop. We measure the width of
  // the first half once on mount.
  const translateX = useRef(new Animated.Value(0)).current;
  const [halfWidth, setHalfWidth] = useState(0);

  useEffect(() => {
    if (halfWidth <= 0) return;
    translateX.setValue(direction === 'left' ? 0 : -halfWidth);
    const loop = Animated.loop(
      Animated.timing(translateX, {
        toValue: direction === 'left' ? -halfWidth : 0,
        duration: durationMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [halfWidth, direction, durationMs, translateX]);

  // Liquid Glass on iOS 26+ — GlassSurface with bordered={false} forces
  // glassStyle='clear' (see-through refraction, no tint) so the chip
  // reads as a real floating bubble on the peach gradient. On older iOS
  // the fallback path is a transparent View (bareEdge in GlassSurface),
  // matching what the user wanted: no gray box either way.
  const renderChip = (chip: Chip, idx: number) => (
    <GlassSurface
      key={`${chip.label}-${idx}`}
      variant="pill"
      bordered={false}
      style={styles.chip}
    >
      <Text style={[styles.chipText, chipTextStyle(chip.s)]}>{chip.label}</Text>
    </GlassSurface>
  );

  return (
    <View style={styles.marqueeRow}>
      <Animated.View
        style={[styles.marqueeInner, { transform: [{ translateX }] }]}
      >
        <View
          style={styles.marqueeHalf}
          onLayout={(e) => {
            // Width of one half; the other half is rendered identical for
            // a seamless wrap.
            if (halfWidth === 0) setHalfWidth(e.nativeEvent.layout.width);
          }}
        >
          {chips.map(renderChip)}
        </View>
        <View style={styles.marqueeHalf}>{chips.map(renderChip)}</View>
      </Animated.View>
    </View>
  );
}

function chipTextStyle(s: ChipStyle): TextStyle {
  const fontFamily = s.serif
    ? Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' })
    : undefined;
  return {
    fontWeight: s.weight ?? '600',
    fontStyle: s.italic ? 'italic' : 'normal',
    fontSize: s.size ?? 13,
    letterSpacing: s.letterSpacing,
    textTransform: s.upper ? 'uppercase' : s.lower ? 'lowercase' : 'none',
    fontFamily,
  };
}

// ─── Screen ──────────────────────────────────────────────────────────────

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
      <StatusBar barStyle="dark-content" />

      {/* Base gradient — peach warmth (white top → coral bottom). */}
      <BackgroundGradient />

      <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
        {/* Brand marquee — 3 rows, alternating direction. */}
        <View style={styles.marquee}>
          <MarqueeRow chips={ROW_1} direction="left" durationMs={38000} />
          <MarqueeRow chips={ROW_2} direction="right" durationMs={44000} />
          <MarqueeRow chips={ROW_3} direction="left" durationMs={41000} />
        </View>

        {/* Centered title */}
        <View style={styles.middle}>
          <Text style={styles.title}>
            채팅 하나로{'\n'}5000+ 디자이너 브랜드{'\n'}디깅하기
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {/* Sign in with Apple is iOS-only per Apple's platform policy.
              Hide on Android so users don't tap a button that immediately
              throws a "iOS only" alert. */}
          {Platform.OS === 'ios' && (
            <Pressable
              accessibilityLabel="Apple로 시작"
              disabled={busy !== null}
              onPress={onApple}
              style={({ pressed }) => [
                styles.appleBtn,
                pressed && styles.appleBtnPressed,
                busy === 'apple' && styles.btnBusy,
              ]}
            >
              <SymbolView
                name="applelogo"
                size={17}
                tintColor="#FFFFFF"
                weight="medium"
              />
              <Text style={styles.appleBtnText}>Apple로 시작</Text>
            </Pressable>
          )}

          <Pressable
            accessibilityLabel="Google로 시작"
            disabled={busy !== null}
            onPress={onGoogle}
            style={({ pressed }) => [
              styles.googleBtn,
              pressed && styles.btnPressed,
              busy === 'google' && styles.btnBusy,
            ]}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={styles.googleBtnText}>Google로 시작</Text>
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
          ·{' '}
          <Text
            style={styles.termsLink}
            onPress={() => Linking.openURL('https://kikoai.me/privacy')}
          >
            개인정보처리방침
          </Text>
          에{'\n'}동의하는 것으로 간주됩니다.
        </Text>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────

const INK = '#0a0a0a';
const INK_SUBTLE = 'rgba(10,10,10,0.55)';
const INK_LINK = 'rgba(10,10,10,0.85)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fefcfa' },
  safe: { flex: 1, paddingVertical: 16 },

  // Marquee
  marquee: {
    gap: 10,
    paddingTop: 8,
  },
  marqueeRow: {
    height: 40,
    overflow: 'hidden',
  },
  marqueeInner: {
    flexDirection: 'row',
  },
  marqueeHalf: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 5,
  },
  chip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    color: INK,
    lineHeight: 16,
  },

  // Title block. Reduced bottom padding pushes the entire actions+terms
  // footer stack down toward the safe-area edge.
  middle: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '700',
    letterSpacing: -0.775,
    color: INK,
    textAlign: 'center',
  },

  // Actions
  actions: {
    paddingHorizontal: 22,
    gap: 9,
  },
  appleBtn: {
    height: 50,
    borderRadius: 50,
    backgroundColor: INK,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  appleBtnPressed: { opacity: 0.86 },
  appleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.15,
  },
  // White in both light + dark mode per design — never tinted by system
  // theme. Text/logo stay ink (readable on white).
  googleBtn: {
    height: 50,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  googleG: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4285F4',
    lineHeight: 18,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: INK,
    letterSpacing: -0.15,
  },
  btnPressed: { opacity: 0.9 },
  btnBusy: { opacity: 0.5 },

  // Terms
  terms: {
    fontSize: 11,
    color: INK_SUBTLE,
    textAlign: 'center',
    lineHeight: 16.5,
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 14,
  },
  termsLink: {
    color: INK_LINK,
    textDecorationLine: 'underline',
  },
});

// Avoid unused warning for SCREEN_W if marquee math doesn't need it elsewhere.
void SCREEN_W;
