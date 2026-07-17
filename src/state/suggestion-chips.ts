/**
 * 골든셋 유도 칩 — 단일 소스. home.tsx(실화면)와 curation-lab.tsx(시안)가
 * 공유한다. GET /v1/curation 응답 chips[] 계약과 동일 형태 — API 연동 시
 * 이 상수는 서버 응답의 폴백이 된다.
 *
 * 노출은 한국어(label), 실행은 검증된 영어 쿼리(query). 칩 = 완전 통제된
 * 입력 → 검증 통과 값만 태운다. 골든셋 최종(여 7/13 · 남 7/14) 결론:
 *   여성 = 문형 채택 방식 (무드 95%·소재 90%·핏 85%·컬러 75%). TPO·가격 배제.
 *   남성 = 값 화이트리스트 방식 (모든 문형 75% 미달 — 검증 통과 값만 개별 등록).
 * 미검증 값은 실제 검색 경로 실행 + top-10 육안 판정 후에만 반영
 * (ai-server scripts/goldenset/run_goldenset.py).
 */

export type SuggestionChip = {
  id: string;
  pattern: 'mood' | 'aesthetic' | 'fit' | 'pattern' | 'material' | 'color';
  /** 화면 노출 (KO — 글로벌 전환 시 이 필드만 교체) */
  label: string;
  /** 검색 API 전송 (EN 골든셋 검증 쿼리 — 임베딩에 그대로 들어간다) */
  query: string;
  /** search_products_v6 family gate 용 카테고리 힌트 */
  category: string;
};

export const SUGGESTION_CHIPS_WOMEN: readonly SuggestionChip[] = [
  { id: 'chip-w1', pattern: 'mood', label: '유니크한 미니백', query: 'quirky unique mini bag', category: 'bag' }, // S 확정 (검증 쿼리 원문)
  { id: 'chip-w2', pattern: 'aesthetic', label: 'Y2K 스타일 탑', query: 'y2k top', category: 'top' }, // 화이트리스트 S
  { id: 'chip-w3', pattern: 'fit', label: '카프리 팬츠', query: 'capri pants', category: 'pants' }, // S (7/14 현규 판정)
  { id: 'chip-w4', pattern: 'fit', label: '로우라이즈 진', query: 'low rise jeans', category: 'jeans' }, // S (7/14 현규 판정)
  { id: 'chip-w5', pattern: 'mood', label: '로맨틱한 원피스', query: 'romantic dress', category: 'dress' }, // S 확정
] as const;

// 남성 4종 — 전부 7/14 현규 실검색 top-10 육안 판정 확정 값.
export const SUGGESTION_CHIPS_MEN: readonly SuggestionChip[] = [
  { id: 'chip-m1', pattern: 'fit', label: '크롭 반팔티', query: 'cropped tee', category: 'tee' },
  { id: 'chip-m2', pattern: 'pattern', label: '카모 패턴 카고 팬츠', query: 'camo cargo pants', category: 'pants' },
  { id: 'chip-m3', pattern: 'fit', label: '루즈핏 데님 팬츠', query: 'loose fit denim pants', category: 'jeans' },
  { id: 'chip-m4', pattern: 'aesthetic', label: '여름 인디 밴드 티셔츠', query: 'summer indie band tee', category: 'tee' },
] as const;

export function chipsForGender(gender: 'women' | 'men' | null | undefined): readonly SuggestionChip[] {
  return gender === 'men' ? SUGGESTION_CHIPS_MEN : SUGGESTION_CHIPS_WOMEN;
}

// 검증된 영어 query → 한국어 label 역매핑. 유도 칩은 버블엔 한국어 label 을
// 보이지만 서버엔 영어 query 를 보내 저장하므로, 재입장(getMessages) 시 유저
// 메시지가 영어로 뜬다. 이 맵으로 알려진 칩 query 를 한국어 label 로 되돌린다.
const CHIP_QUERY_TO_LABEL: ReadonlyMap<string, string> = new Map(
  [...SUGGESTION_CHIPS_WOMEN, ...SUGGESTION_CHIPS_MEN].map((c) => [
    c.query.trim().toLowerCase(),
    c.label,
  ]),
);

/** 텍스트가 알려진 유도 칩의 영어 query 면 한국어 label 을, 아니면 null. */
export function chipLabelForQuery(text: string): string | null {
  return CHIP_QUERY_TO_LABEL.get(text.trim().toLowerCase()) ?? null;
}
