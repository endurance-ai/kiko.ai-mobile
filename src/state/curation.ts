/**
 * 메인 큐레이션 데이터 — GET /v1/curation (auth optional) 연동.
 *
 * server-driven: 구좌 개수·순서·타이틀·상품과 유도 칩 전부 서버 응답으로
 * 결정된다 (앱 배포 없이 교체 가능). gender 해석은 서버 규칙을 따른다 —
 * 로그인 유저는 프로필 우선, 비로그인은 온보딩 로컬값을 query param 으로.
 *
 * 폴백 계단 (7/13 확정 스펙 "마지막 성공 응답 캐시"):
 *   서버 응답 → AsyncStorage 캐시(마지막 성공 응답) → null
 *   (null 이면 CurationSheet 가 mock, home 칩이 로컬 골든셋 상수로 폴백).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { OnboardingGender } from '@/state/onboarding';
import type { SuggestionChip } from '@/state/suggestion-chips';
import type { CurationResponse, CurationSection } from '@/types/api';

const CACHE_KEY_PREFIX = 'kiko:curation:cache:v1:';

function cacheKey(gender: OnboardingGender | null): string {
  // gender 미상(재설치한 기존 계정 유저 등)은 서버가 프로필로 해석 —
  // 캐시도 별도 슬롯에 둔다.
  return `${CACHE_KEY_PREFIX}${gender ?? 'profile'}`;
}

// 서버 chips[] → 홈 composer 유도 칩. 빈 배열(men 골든셋 등록 전)은 null 을
// 돌려 호출부가 로컬 상수(suggestion-chips.ts)로 폴백하게 한다.
function toSuggestionChips(res: CurationResponse): SuggestionChip[] | null {
  if (res.chips.length === 0) return null;
  return res.chips.map((c) => ({
    id: c.id,
    // 서버 pattern 은 자유 문자열 (골든셋 문형 분류) — 칩 렌더는 label/query
    // 만 쓰므로 미지의 값이 와도 무해하다.
    pattern: c.pattern as SuggestionChip['pattern'],
    label: c.label_ko,
    query: c.query_en,
    category: c.category,
  }));
}

export function useCuration(gender: OnboardingGender | null): {
  sections: CurationSection[] | null;
  chips: SuggestionChip[] | null;
} {
  const [data, setData] = useState<CurationResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    let gotFresh = false;

    // 1) 캐시 즉시 표시 (구좌가 늦게 뜨는 빈 화면 방지)
    void AsyncStorage.getItem(cacheKey(gender)).then((raw) => {
      if (cancelled || gotFresh || !raw) return;
      try {
        setData(JSON.parse(raw) as CurationResponse);
      } catch {
        // 캐시 손상 — 서버 응답이 덮어쓴다
      }
    });

    // 2) 서버 fetch — 성공 시 상태·캐시 갱신, 실패 시 캐시 유지
    api
      .get<CurationResponse>('/v1/curation', gender ? { gender } : undefined)
      .then((res) => {
        if (cancelled) return;
        gotFresh = true;
        setData(res);
        void AsyncStorage.setItem(cacheKey(gender), JSON.stringify(res));
      })
      .catch(() => {
        // 비로그인+gender 미상이면 422 정상 — 캐시/폴백 경로로 처리
      });

    return () => {
      cancelled = true;
    };
  }, [gender]);

  return {
    sections: data && data.sections.length > 0 ? data.sections : null,
    chips: data ? toSuggestionChips(data) : null,
  };
}
