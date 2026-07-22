import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  applyOtaAndReload,
  checkAndFetchOta,
  evaluateStoreGate,
  fetchAppConfig,
} from '@/lib/app-update';
import { Haptic, IOSColors, IOSFont, IOSText, Opacity, Radius, Scrim, withAlpha } from '@/theme';

// 포그라운드 복귀마다 네트워크를 때리지 않도록 최소 간격. blocked 판정은
// 이 창과 무관하게 매번 강제되지만, config fetch 자체는 이 간격으로 throttle.
const MIN_RECHECK_MS = 30_000;

type GateState =
  | { kind: 'idle' }
  | { kind: 'blocked'; storeUrl: string } // 강제 — 닫기 불가
  | { kind: 'soft'; storeUrl: string } // 권장 — 닫기 가능
  | { kind: 'ota' }; // OTA 번들 준비됨 — 지금 적용?

/**
 * 앱 실행/포그라운드 복귀 시 업데이트 게이트를 평가해 모달을 띄운다.
 * 루트에 한 번만 마운트한다. fail-open — 어떤 실패도 앱을 막지 않는다.
 */
export function AppUpdateGate() {
  const [state, setState] = useState<GateState>({ kind: 'idle' });
  const lastRunRef = useRef(0);
  const softDismissedRef = useRef(false); // 세션당 권장 모달 1회만
  const otaDismissedRef = useRef(false); // 세션당 OTA 모달 1회만

  const run = useCallback(async () => {
    const now = Date.now();
    if (now - lastRunRef.current < MIN_RECHECK_MS) return;
    lastRunRef.current = now;

    // B) 스토어 게이트 — iOS 만(설정에 ios 만 존재). Android 는 OTA 만.
    const cfg = await fetchAppConfig();
    const gate = Platform.OS === 'ios' ? evaluateStoreGate(cfg) : { kind: 'none' as const };
    if (gate.kind === 'blocked') {
      setState({ kind: 'blocked', storeUrl: gate.storeUrl });
      return;
    }

    // A) OTA — 강제 업데이트가 아닐 때만. 새 번들을 받아두면 적용 모달.
    if (!otaDismissedRef.current) {
      const otaReady = await checkAndFetchOta();
      if (otaReady) {
        setState({ kind: 'ota' });
        return;
      }
    }

    // 권장(soft) 은 세션당 1회만 노출.
    if (gate.kind === 'soft' && !softDismissedRef.current) {
      setState({ kind: 'soft', storeUrl: gate.storeUrl });
    }
  }, []);

  useEffect(() => {
    // 초기 1회는 다음 틱에 시작 — 이펙트 본문에서 동기 setState 를 피한다.
    const t = setTimeout(() => void run(), 0);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void run();
    });
    return () => {
      clearTimeout(t);
      sub.remove();
    };
  }, [run]);

  const openStore = useCallback((url: string) => {
    Haptic.medium();
    void Linking.openURL(url).catch(() => {
      // 딥링크 실패 시 https 폴백.
      const web = url.replace('itms-apps://', 'https://');
      void Linking.openURL(web).catch(() => undefined);
    });
  }, []);

  const dismissSoft = useCallback(() => {
    softDismissedRef.current = true;
    setState({ kind: 'idle' });
  }, []);

  const applyOta = useCallback(() => {
    Haptic.medium();
    void applyOtaAndReload();
  }, []);

  const dismissOta = useCallback(() => {
    otaDismissedRef.current = true;
    setState({ kind: 'idle' });
  }, []);

  if (state.kind === 'idle') return null;

  const blocking = state.kind === 'blocked';
  const copy = MODAL_COPY[state.kind];

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="fade"
      // 강제 모달은 백버튼/스와이프로 못 닫게(no-op). 나머지는 '나중에'와 동일.
      onRequestClose={() => {
        if (state.kind === 'soft') dismissSoft();
        else if (state.kind === 'ota') dismissOta();
      }}
    >
      <View style={styles.scrim}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{copy.emoji}</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              if (state.kind === 'ota') applyOta();
              else openStore(state.storeUrl);
            }}
          >
            <Text style={styles.primaryText}>{copy.primary}</Text>
          </Pressable>

          {!blocking && (
            <Pressable
              style={styles.secondaryBtn}
              onPress={state.kind === 'ota' ? dismissOta : dismissSoft}
            >
              <Text style={styles.secondaryText}>나중에</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const MODAL_COPY = {
  blocked: {
    emoji: '🚀',
    title: '업데이트가 필요해요',
    body: '원활한 사용을 위해 최신 버전으로 업데이트해 주세요.',
    primary: '업데이트하기',
  },
  soft: {
    emoji: '✨',
    title: '새 버전이 나왔어요',
    body: '더 나아진 키코를 App Store에서 만나보세요.',
    primary: '지금 업데이트',
  },
  ota: {
    emoji: '✨',
    title: '새 버전이 준비됐어요',
    body: '지금 적용하면 바로 최신 상태로 시작해요.',
    primary: '지금 적용',
  },
} as const;

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: withAlpha('#000000', Scrim.heavy),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: Radius.xxl,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 16,
    alignItems: 'center',
  },
  emoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  title: {
    ...IOSText.title3,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
  },
  body: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  primaryBtn: {
    width: '100%',
    height: 52,
    borderRadius: Radius.xl,
    backgroundColor: IOSColors.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
  secondaryBtn: {
    width: '100%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  secondaryText: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    opacity: Opacity.nearFull,
  },
});
