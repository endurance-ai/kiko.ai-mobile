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
// 채팅 세션 ID — home 이 SSE session 이벤트로 받으면 여기 캐시해 두고,
// session_id 를 직접 싣지 않는 이벤트(wishlist 등)에 자동 첨부한다.
// (기획 7/23: 세션 문맥 없는 이벤트는 역추적 조인이 안 됨)
let cachedSessionId: string | null = null;

/** home 의 SSE 세션 확정 시점에 호출. null 로 해제. */
export function setAnalyticsSessionId(sessionId: string | null): void {
  cachedSessionId = sessionId;
}

// init 완료 전에 발화된 이벤트 버퍼 — 콜드 스타트에선 홈 마운트
// (main_screen_viewed, 첫 임프레션)가 initAnalytics 의 async init 보다
// 빨라서, initialized 가드가 이벤트를 조용히 삼키는 레이스가 있다
// (시뮬레이터 실측: 콜드 스타트 main_screen_viewed 유실 — A1 재발 경로).
// init 성공 시 재발사하고, 실패(키 없음 등) 시엔 상한까지만 쌓고 버린다.
const PENDING_MAX = 100;
let pendingEvents: Array<{
  name: string;
  props: Record<string, unknown>;
}> = [];

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
    // init 전에 큐잉된 이벤트 재발사 — ts 는 큐잉 시점 값을 보존한다.
    const queued = pendingEvents;
    pendingEvents = [];
    for (const e of queued) trackEvent(e.name, e.props);
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
  cachedSessionId = null;
  pendingEvents = [];
  impressionSeen.clear();
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
  if (!initialized) {
    // init 완료 전 — 유실 대신 큐잉 (init 성공 시 재발사).
    if (pendingEvents.length < PENDING_MAX) {
      pendingEvents.push({
        name,
        props: { ts: Date.now(), ...(props ?? {}) },
      });
    }
    return;
  }
  try {
    const payload: Record<string, unknown> = {
      ts: Date.now(),
      ...(cachedUserId ? { user_id: cachedUserId } : {}),
      // 호출부가 session_id 를 직접 실으면 그 값이 이김 (아래 spread).
      ...(cachedSessionId ? { session_id: cachedSessionId } : {}),
      ...(props ?? {}),
    };
    track(name, payload);
  } catch {
    // silent
  }
}

// ── 온보딩 퍼널 (기획 스펙 2026-07) ────────────────────────────────────────
// platform 은 온보딩 퍼널 전 이벤트의 공통 프로퍼티라, 개별 호출부에서
// 매번 싣지 않고 이 헬퍼가 자동 주입한다. 각 스텝은 필요한 추가
// 프로퍼티(gender, selected_brands 등)만 넘기면 된다. Platform.OS 는
// 'ios' | 'android' | 'web' — 웹은 dev 프리뷰 경로라 스펙 허용값(ios/android)
// 밖이지만 그대로 흘려보낸다(분석에서 필터).
export type OnboardingEvent =
  | 'onboarding_welcome_viewed'
  | 'onboarding_welcome_next_clicked'
  | 'onboarding_welcome2_viewed'
  | 'onboarding_welcome2_next_clicked'
  | 'onboarding_gender_viewed'
  | 'onboarding_gender_completed'
  | 'onboarding_preference_viewed'
  | 'onboarding_preference_completed'
  | 'main_screen_viewed';

export function trackOnboarding(
  event: OnboardingEvent,
  props?: Record<string, unknown>,
): void {
  trackEvent(event, { platform: Platform.OS, ...props });
}

// (search_id, product_id, source) 조합 dedupe. 페이지네이션 재렌더 / 리스트
// 스크롤 왕복 / 컴포넌트 unmount+remount 로 같은 카드가 다시 mount 돼도 세션
// 내 1회만 발사. resetAnalytics 시 초기화.
const impressionSeen = new Set<string>();

/** 상품 카드가 렌더될 때 1개당 1회 발사. 스펙: product_impression =
 * "노출됐지만 미선택" 신호 확보 (product_view 와 짝 맞춤).
 *
 * 문맥 키 규칙 (2026-07-23 기획 — 큐레이션 impression 유실 수정):
 * - search 발(發): search_id 필수 — 없으면 skip (기존 오염 방지 유지)
 * - curation 발: section_id 필수 — search_id 는 원래 없음. 기존 가드가
 *   search_id 부재를 이유로 큐레이션 노출을 전부 drop 하던 버그 수정.
 * 같은 (문맥|product|source) 조합은 세션 내 dedupe (재렌더/스크롤 왕복). */
export function trackProductImpression(params: {
  productId: string;
  brand: string | null | undefined;
  searchId: string | null | undefined;
  /** 큐레이션 구좌 ID (popular / trending-search / under-100 / editorial-*) */
  sectionId?: string | null;
  position?: number | null;
  source?: string;
}): void {
  // initialized 가드 없음 — init 전 발화는 trackEvent 가 큐잉한다.
  // (dedupe Set 은 init 여부와 무관하게 동작해야 재발사 중복이 없다)
  const source = params.source ?? "search";
  // 발화 문맥: 검색은 search_id, 큐레이션은 section_id 가 조인 키.
  // 둘 다 없으면 역추적 조인이 불가능한 고아 이벤트라 skip (오염 방지).
  const contextKey = params.searchId ?? params.sectionId;
  if (!contextKey) return;
  const key = `${contextKey}|${params.productId}|${source}`;
  if (impressionSeen.has(key)) return;
  impressionSeen.add(key);
  trackEvent("product_impression", {
    product_id: params.productId,
    brand: params.brand ?? null,
    search_id: params.searchId ?? null,
    section_id: params.sectionId ?? null,
    position: params.position ?? null,
    source,
  });
}
