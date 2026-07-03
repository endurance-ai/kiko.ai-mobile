import {
  Identify,
  identify,
  init,
  reset,
  setUserId,
  track,
} from '@amplitude/analytics-react-native';

// EXPO_PUBLIC_ prefix 는 클라이언트 번들에 인라인됨 — 앰플리튜드 client
// SDK key 는 원래 노출 대상이라 안전. 서버 API key 는 별개.
const KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;

let initialized = false;

/** 앱 부팅 시 한 번 호출. 키가 없거나 실패해도 조용히 pass. */
export async function initAnalytics(): Promise<void> {
  if (initialized || !KEY) return;
  try {
    await init(KEY, undefined, {
      // Amplitude 라이브러리 로그 억제 (기본 warn)
      logLevel: 3,
      trackingSessionEvents: true,
    }).promise;
    initialized = true;
  } catch {
    // 초기화 실패는 앱 흐름을 절대 막지 않는다.
  }
}

/** 유저 로그인 성공 시 호출. traits 는 user properties 로 저장. */
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
): void {
  if (!initialized) return;
  try {
    setUserId(userId);
    if (traits && Object.keys(traits).length > 0) {
      const ident = new Identify();
      for (const [k, v] of Object.entries(traits)) {
        if (v == null) continue;
        if (typeof v === 'boolean') {
          ident.set(k, v ? 1 : 0);
        } else {
          ident.set(k, v as string | number);
        }
      }
      identify(ident);
    }
  } catch {
    // silent
  }
}

/** 로그아웃 시 호출 — 세션 / 유저 식별자 초기화. */
export function resetAnalytics(): void {
  if (!initialized) return;
  try {
    reset();
  } catch {
    // silent
  }
}

/** 이벤트 트래킹 — 실패해도 조용히 무시. */
export function trackEvent(
  name: string,
  props?: Record<string, unknown>,
): void {
  if (!initialized) return;
  try {
    track(name, props);
  } catch {
    // silent
  }
}
