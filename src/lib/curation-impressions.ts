/**
 * 큐레이션 노출(impression) → 서버 전송. 개인화 taste score 의 입력 데이터.
 *
 * ai-server 는 `ai.curation_impressions` 에 쌓인 노출로 taste score 를 만들어
 * `GET /v1/curation` 의 상품 순위를 개인화한다. 그 입력을 넣어주는 게 이 모듈.
 * `POST /v1/curation/impressions` (인증 필수, items 1–50, 서버 일별 dedupe).
 *
 * 설계 원칙:
 * - **비로그인 skip**: 토큰이 없으면 아예 보내지 않는다. api.post 는 401 →
 *   refresh 실패 시 onUnauthorized()(로그아웃)를 트리거하므로, 취향 신호 따위로
 *   유저를 튕기면 안 된다.
 * - **배치**: 노출마다 요청하지 않고 버퍼에 모아 debounce/임계/백그라운드 전환 시
 *   한 번에 보낸다 (서버 max 50).
 * - **best-effort**: 실패해도 재시도·에러 노출 없음. UX 에 영향 주지 않는다.
 * - 세션 dedupe 는 analytics 의 impressionSeen 이 이미 처리 → 새 노출만 들어온다.
 */
import { AppState } from 'react-native';

import { api, getCurrentAccessToken } from '@/lib/api';
import type { CurationImpressionItem, CurationImpressionResponse } from '@/types/api';

const MAX_BATCH = 50; // 서버 CurationImpressionRequest.items 상한
const FLUSH_THRESHOLD = 30; // 버퍼가 차면 debounce 를 기다리지 않고 즉시 flush
const DEBOUNCE_MS = 4000; // 노출이 잦아든 뒤 모아 보낸다

// dedupe key(`section:product`) → item. 같은 카드 재렌더가 버퍼를 부풀리지 않도록.
const pending = new Map<string, CurationImpressionItem>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function keyOf(item: CurationImpressionItem): string {
  return `${item.section_id}:${item.product_id}`;
}

function cancelTimer(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
}

/** 큐레이션 노출 1건을 전송 버퍼에 넣는다. curation 발(發) 노출에서만 호출. */
export function enqueueCurationImpression(item: CurationImpressionItem): void {
  if (!item.section_id) return; // 조인 키 없는 고아 노출은 버린다
  pending.set(keyOf(item), item);

  if (pending.size >= FLUSH_THRESHOLD) {
    void flushCurationImpressions();
    return;
  }
  cancelTimer();
  flushTimer = setTimeout(() => void flushCurationImpressions(), DEBOUNCE_MS);
}

/** 버퍼를 서버로 비운다. 토큰 없으면(비로그인) 조용히 폐기. best-effort. */
export async function flushCurationImpressions(): Promise<void> {
  cancelTimer();
  if (pending.size === 0) return;

  // 비로그인/토큰 미확보 상태의 노출은 개인화 대상이 아니므로 폐기.
  if (!getCurrentAccessToken()) {
    pending.clear();
    return;
  }

  const items = Array.from(pending.values());
  pending.clear();

  for (let i = 0; i < items.length; i += MAX_BATCH) {
    const batch = items.slice(i, i + MAX_BATCH);
    try {
      await api.post<CurationImpressionResponse>('/v1/curation/impressions', { items: batch });
    } catch {
      // best-effort: 실패한 배치는 재시도하지 않는다 (다음 노출에서 자연 보강).
    }
  }
}

// 앱이 백그라운드로 갈 때 남은 노출을 흘려보낸다 (모듈 로드 시 1회 등록).
AppState.addEventListener('change', (state) => {
  if (state === 'background' || state === 'inactive') void flushCurationImpressions();
});
