import {
  add,
  Identify,
  identify,
  init,
  reset,
  setUserId,
  track,
} from '@amplitude/analytics-react-native';
import { Platform } from 'react-native';

// EXPO_PUBLIC_ prefix 는 클라이언트 번들에 인라인됨 — 앰플리튜드 client
// SDK key 는 원래 노출 대상이라 안전. 서버 API key 는 별개.
const KEY = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;

// 자유 제한 정책 버전 — 기획자 이벤트 스펙에 free_limit_version 이 필수.
// 정책 바꿀 때 이 값을 올려 코호트 분석에 반영.
export const FREE_LIMIT_VERSION = "v1";

let initialized = false;
// setUserId 는 SDK 안에 저장되지만 매 이벤트 프로퍼티에도 user_id 를 실어
// 달라는 요구가 있어 편의상 module-level 캐시로 유지. resetAnalytics 시 해제.
let cachedUserId: string | null = null;

/** 앱 부팅 시 한 번 호출. 키가 없거나 실패해도 조용히 pass. */
export async function initAnalytics(): Promise<void> {
  if (initialized || !KEY) return;
  try {
    await init(KEY, undefined, {
      // Amplitude 라이브러리 로그 억제 (기본 warn)
      logLevel: 3,
      trackingSessionEvents: true,
    }).promise;
    // Session Replay 는 native 전용 모듈 — 웹 번들에서 모듈 평가 시점에
    // requireNativeComponent 를 호출해 크래시하므로 native 에서만 lazy 로드.
    // dev client 에 native 링크가 없으면 조용히 실패해도 이벤트
    // 트래킹 자체엔 영향 없음.
    if (Platform.OS !== 'web') {
      try {
        const { SessionReplayPlugin } = await import(
          '@amplitude/plugin-session-replay-react-native'
        );
        await add(new SessionReplayPlugin()).promise;
      } catch {
        // native 모듈 미링크 — 무시
      }
    }
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
  cachedUserId = userId;
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
  cachedUserId = null;
  if (!initialized) return;
  try {
    reset();
  } catch {
    // silent
  }
}

/** 이벤트 트래킹 — user_id 는 매 이벤트 프로퍼티에 자동 첨부.
 * 실패해도 조용히 무시. */
export function trackEvent(
  name: string,
  props?: Record<string, unknown>,
): void {
  if (!initialized) return;
  try {
    const payload: Record<string, unknown> = {
      ts: Date.now(),
      ...(cachedUserId ? { user_id: cachedUserId } : {}),
      ...(props ?? {}),
    };
    track(name, payload);
  } catch {
    // silent
  }
}
