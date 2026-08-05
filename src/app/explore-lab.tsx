/**
 * [v1.2 시안] Explore — 메인(루트) 화면. 2026-08-04 IA 확정본.
 *
 * IA: Explore 는 앱의 단일 루트. 동급 표면은 Explore·뉴스 둘뿐이며 전환은
 * ☰ 사이드바(/lab-sidebar)로만. Chat 은 동급이 아니라 드릴다운 — 칩/전송
 * 시 쿼리를 들고 /chat-lab 으로 push (SendPayload: display KO / query EN).
 * 컴포저 발화 = 탐색 맥락 승계(새 스레드), 상세는 기능정의서 v1.2.
 *
 * 대화는 chat-lab 핸드오프 — 이 화면에 대화 없음(2026-08-04 확정). 상단 =
 * ☰ + 중앙 타이틀(상시) + 벨·찜. 벨 = 빨간 점 → 알림함 /notif-inbox-lab
 * (히스토리 필 대체, 2026-08-04). 구좌 헤더 = [타이틀 ›] 공통 규격(20
 * Semibold, "더보기" 금지). 웹 셰브런은 광학 보정(30/600/translateY-2),
 * 실기기는 SF chevron.right.
 *
 * ── v1.2 Explore 큐레이션 구좌 구조 (2026-08-04 확정, 후르츠패밀리 22구좌
 * 분석 기반) ────────────────────────────────────────────────────────────
 * 기존 구좌 4종(SECTION_DEFS)을 폐기하고 아래 10지면으로 교체했다. 순서
 * 고정. **모든 구좌 타이틀/서브 카피는 가칭 — 사용자가 추후 일괄 교체
 * 예정**(코드 곳곳의 "가칭" 주석 참조).
 *
 *  1. 메인 배너      — 횡 스냅 카드 3장, 지면 자체가 헤더 없음.
 *  2. 최근 본 상품    — 상품 행(정사각). 개인화 전용(A안 숨김). 열람 로그
 *     상품 단위 최근순(2026-08-04 밤 확정 — 브랜드 필에서 상품 카드로 변경,
 *     후르츠 3번 문법). 탭 → PDP, 헤더 › → 히스토리 리스트.
 *  3. 방금 할인된 찜  — 상품 행. 개인화 전용(A안 숨김).
 *  4. 취향 세일, 신상 — 상품 행. 블렌디드(항상 노출).
 *  5. 10만원 아래     — 상품 행. 범용(항상 노출).
 *  6. 요즘 뜨는 브랜드 — 상품 행, 브랜드당 대표 1개(= 그 브랜드에서 요즘
 *     가장 많이 찜된 상품). 블렌디드. "요즘 많이 찜해요" 구좌를 병합
 *     (2026-08-04 밤 확정 — 인기 축 구좌는 이거 하나).
 *  7. 상황별로 찾기   — 쿼리 칩 횡스크롤 → chat 핸드오프. 채팅이 메인
 *     피처라 하단이 아니라 디깅 흐름 중간에 배치(2026-08-04 밤 확정).
 *  8. 팔로우 브랜드   — 상품 행. 개인화 전용(A안 숨김).
 *  9. 브랜드 픽       — 브랜드 배너 카드 + 동일 브랜드 상품 행 페어링(후르츠
 *     9+10 문법). 항상 노출.
 * 10. 몰랐던 브랜드   — 브랜드 스포트라이트(소개 텍스트) + 상품 행. 항상 노출.
 *
 * 개인화 2등급: **100% 개인화**(데이터 없으면 구좌 자체를 숨김 — 2/3/7번)
 * vs **블렌디드**(인기 풀 × 취향 가중 w=0.3~0.4, 항상 성립 — 4/5/6번).
 * 1/7/9/10번은 범용이라 개인화 여부와 무관하게 항상 노출.
 *
 * 가격, 취향 낙차(3→4→5번, 2026-08-04 밤 사용자 확정 — 취향 세일 신상을
 * 10만원 아래 위로): 방금 할인된 찜(내 것, 가장 강함) → 취향 세일, 신상
 * (취향 저격 이벤트 — watch & pounce 구좌, A안에선 이게 첫 구좌라 신규
 * 유저도 취향 지면부터 만난다) → 10만원 아래(범용 캐치올).
 *
 * 브랜드 3단 블록(6→9→10번) = 요즘 뜨는 브랜드(자동 집계, 브랜드
 * 스코어×취향 가중) → 브랜드 픽(MD 앵커, 주 단위 로테이션) → 몰랐던
 * 브랜드(MD 발굴, 저인지 브랜드 스포트라이트). 자동화 정도가 점점 옅어지고
 * 에디토리얼 개입이 짙어지는 순서.
 *
 * 구좌 간 상품 중복 제거는 전역 규칙 — mock 에서도 슬롯별 상품이 겹치지
 * 않도록 EXTRA_BRANDS 의 모든 항목에 고유 id 를 부여하고, 각 지면이 서로
 * 다른 id 부분집합만 참조한다(assembleSlotProducts/BRAND_PICK_PRODUCT_IDS/
 * UNKNOWN_BRAND_PRODUCT_IDS 참조).
 *
 * 카드 사이즈 3종 체계(애플뮤직 문법, 2026-08-04 사용자 확정) — 화면 내
 * 콘텐츠 카드는 딱 3가지 사이즈만 쓴다: ① 세로로 약간 긴 직사각형 1.5개
 * 노출(메인 배너, 피크 캐러셀 — 페이지 도트 없음, 피크가 어포던스) ②
 * 정사각형 2.5개 노출(모든 상품 카드 — ProductCard.size 로 배선) ③ 가로
 * 직사각형 풀폭 1개(브랜드 픽 배너). 이 3종 외 카드 사이즈 금지. 계산은
 * 화면폭 기반 — bannerCardWidth()/squareCardWidth() 참조.
 *
 * A/B 데브 토글(좌하단 플로팅 필) — A=개인화 데이터 없음(신규 유저 가정,
 * 디폴트), B=개인화 데이터 보유. hasPersonalData state 하나로 2/3/7번
 * 구좌의 노출 여부를 즉시 토글해 두 시나리오를 한 화면에서 비교할 수
 * 있게 한 시연용 장치 — 실서비스엔 없음, 커밋 정리 시 제거 대상.
 *
 * dev-only. 내비게이션(실서비스 sidebar 등)에 연결 금지.
 *
 * 히어로 폐기(2026-08-04 밤 확정) — 선언형 카피 3종 로테이션과 라지 타이틀
 * 실험 모두 제거. 상단 = ☰ + 중앙 내비 타이틀 "Explore"(상시, 뉴스 탭과
 * 동일 문법) + 벨·찜. 첫 발화는 텍스트가 아니라 메인 배너(첫 큐레이션
 * 지면)가 담당 — "매일 새로움"은 배너 데일리 카드로 소화 검토.
 * 대화는 chat-lab 핸드오프라 이 화면에 쌓이지 않음 — 공존안 잔재(복귀 필,
 * 점프 버튼, 대화 블록)는 2026-08-04 밤 전부 삭제.
 *
 * 규칙 참고: docs/design-system.md — 모든 디자인 값은 `@/theme` 토큰을
 * 사용하고(`IOSColors`, `IOSText`, `Spacing`, `Radius`, `Glass`, `Motion` 등),
 * 반투명 표면은 전부 `GlassSurface` + `Glass.*` 프리셋을 통해서만 그린다.
 * 순수 구조적 레이아웃 수치(flex, %, hitSlop)는 예외로 하드코딩을 허용한다.
 *
 * 재사용 컴포넌트: `ProductCard`(src/components/product-card.tsx),
 * `GlassSurface`(src/components/glass-surface.tsx).
 */
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Fragment, useMemo, useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { BANNER_CARD_ASPECT, GlowBannerCard } from '@/components/glow-banner-card';
import { PATTERN_ARCS_BLUE, PATTERN_RING_GREEN } from '@/state/banner-patterns';
import { ProductCard } from '@/components/product-card';
import {
  Glass,
  Haptic,
  IOSColors,
  IOSFont,
  IOSText,
  Motion,
  Radius,
  RadiusRole,
} from '@/theme';
import { MOCK_PRODUCTS, type Product } from '@/state/products';

// 웹 전용 SF bell(아웃라인) 근사 SVG — SymbolView 미렌더 폴백. stroke 기반
// 아웃라인 (SF Symbol 'bell' 과 웨이트 일치 — filled 는 bell.fill 용).
const bellUri = (stroke: string) =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4.2c-3 .4-5 2.9-5 6v3.6l-1.6 2.4c-.3.5 0 1.1.6 1.1h12c.6 0 .9-.6.6-1.1L17 13.8v-3.6c0-3.1-2-5.6-5-6zM12 4.2V3.4M10.2 19.6a1.9 1.9 0 003.6 0"/></svg>`;

// 메인 배너 글로우 카드는 재사용 템플릿으로 분리됨 — src/components/glow-banner-card.tsx
// (bannerGlowUri·logoUri·GlowBannerCard). 여기선 import 해서 쓴다(2026-08-05).

// 구 Spacing 토큰 값 (main Phase 2 dead-code 제거로 theme에서 삭제됨) —
// 프로토타입 로컬로 유지. 스페이싱 토큰 재도입 여부는
// docs/design-system-migration.md §3.2 논의 대상.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

// ── Mock 데이터 (v1.2 11지면, 2026-08-04) ──────────────────────────────
// products.ts 의 Product 를 로컬 확장 — 세일(oldPriceWon)/신상(isNew) 표기는
// 큐레이션 mock 전용이라 products.ts 자체는 건드리지 않는다.
type LabProduct = Product & { oldPriceWon?: number; isNew?: boolean };

// EXTRA_BRANDS 확장(기존 6개 → 신규 약 19개 추가, 총 25개) — 모든 항목에
// 고유 id 를 직접 부여해 "슬롯 간 상품 중복 없이 분배"(전역 규칙)를 코드
// 레벨에서 강제한다: 아래 assembleSlotProducts / BRAND_PICK_PRODUCT_IDS /
// UNKNOWN_BRAND_PRODUCT_IDS 가 각기 다른 id 부분집합만 참조하고, 어떤 id도
// 두 번 이상 쓰이지 않는다(육안 검증 완료). MOCK_PRODUCTS(12) + 이 배열
// (25) = 총 37개 mock 카탈로그 — 3~7번 슬롯(범용 풀, 약 28개 내외)과
// 8·9번 슬롯 전용 브랜드 풀(jaded london 6종·marge sherwood 2종·
// partimento 4종)을 합친 규모다.
const EXTRA_BRANDS: Array<{ id: string; brand: string; name: string; priceWon: number; colorHint: string }> = [
  // 기존 5종 유지(기존 partimento 단일 항목은 아래 몰랐던 브랜드 그룹 4종으로 대체)
  { id: 'lab-e1', brand: 'mmlg', name: '와이드 팬츠', priceWon: 58000, colorHint: '#C7B7A3' },
  { id: 'lab-e2', brand: 'thisisneverthat', name: '헤비 후디', priceWon: 89000, colorHint: '#A9A9AE' },
  { id: 'lab-e3', brand: 'salt&paper', name: '스트라이프 셔츠', priceWon: 54000, colorHint: '#B9C4C9' },
  { id: 'lab-e4', brand: 'ader error', name: '그래픽 맨투맨', priceWon: 98000, colorHint: '#CBB8C2' },
  { id: 'lab-e5', brand: 'hidden nyc', name: '카고 팬츠', priceWon: 112000, colorHint: '#9B9C95' },
  // 신규 — 3·4·5·6번(범용 상품 슬롯) 풀
  { id: 'lab-g1', brand: 'OPEN YY', name: '와이드 데님 팬츠', priceWon: 94000, colorHint: '#B7A98F' },
  { id: 'lab-g2', brand: 'OPEN YY', name: '크롭 니트', priceWon: 58000, colorHint: '#D9CCC0' },
  { id: 'lab-g3', brand: 'matin kim', name: '니트 가디건', priceWon: 96000, colorHint: '#E3CFC7' },
  { id: 'lab-g4', brand: 'thisisneverthat', name: '로고 맨투맨', priceWon: 82000, colorHint: '#ADB0B6' },
  { id: 'lab-g5', brand: 'depound', name: '와이드 슬랙스', priceWon: 64000, colorHint: '#CBBFA8' },
  { id: 'lab-g6', brand: 'depound', name: '헤비 스웨트셔츠', priceWon: 72000, colorHint: '#C2B8A2' },
  { id: 'lab-g7', brand: 'slowand', name: '코튼 와이드 팬츠', priceWon: 68000, colorHint: '#D2B7BC' },
  { id: 'lab-g8', brand: 'muzii', name: '오버사이즈 자켓', priceWon: 132000, colorHint: '#A6A0B2' },
  // 6번(팔로우 브랜드) 고정 브랜드 — jaded london 2종 + marge sherwood 2종,
  // 팔로우한 브랜드의 인기 상품(조회/찜/클릭 높은 순) 가정.
  { id: 'lab-jaded-a1', brand: 'jaded london', name: '그래픽 후드 집업', priceWon: 108000, colorHint: '#8E8D92' },
  { id: 'lab-jaded-a2', brand: 'jaded london', name: '스트라이프 니트', priceWon: 79000, colorHint: '#9C9A9E' },
  { id: 'lab-marge-a1', brand: 'marge sherwood', name: '미니 숄더백', priceWon: 168000, colorHint: '#C9B79A' },
  { id: 'lab-marge-a2', brand: 'marge sherwood', name: '램스울 가디건', priceWon: 152000, colorHint: '#B8AC96' },
  // 8번(브랜드 픽) 앵커 — jaded london 4종, 6번과 겹치지 않는 별도 상품
  { id: 'lab-jaded-b1', brand: 'jaded london', name: '오버사이즈 셔츠', priceWon: 118000, colorHint: '#A6A5A9' },
  { id: 'lab-jaded-b2', brand: 'jaded london', name: '카고 팬츠', priceWon: 132000, colorHint: '#86858A' },
  { id: 'lab-jaded-b3', brand: 'jaded london', name: '로고 볼캡', priceWon: 45000, colorHint: '#737277' },
  { id: 'lab-jaded-b4', brand: 'jaded london', name: '삭스 세트', priceWon: 22000, colorHint: '#B0AFB3' },
  // 9번(몰랐던 브랜드) — partimento 4종
  { id: 'lab-part-c1', brand: 'partimento', name: '코튼 데일리 셔츠', priceWon: 62000, colorHint: '#D8CBBB' },
  { id: 'lab-part-c2', brand: 'partimento', name: '와이드 슬랙스', priceWon: 71000, colorHint: '#D2C4B4' },
  { id: 'lab-part-c3', brand: 'partimento', name: '니트 베스트', priceWon: 66000, colorHint: '#D8CBBB' },
  { id: 'lab-part-c4', brand: 'partimento', name: '무지 맨투맨', priceWon: 54000, colorHint: '#CFC2B2' },
];

function buildMockCatalog(): LabProduct[] {
  return [...MOCK_PRODUCTS, ...EXTRA_BRANDS];
}

// id → LabProduct 조회기. 모르는 id 는 mock 데이터 저작 실수(오타 등)이므로
// 조용히 undefined 를 반환하는 대신 즉시 throw 해 초기 렌더에서 드러나게 한다.
function makeById(catalog: LabProduct[]) {
  const map = new Map(catalog.map((p) => [p.id, p] as const));
  return (id: string): LabProduct => {
    const found = map.get(id);
    if (!found) throw new Error(`[explore-lab] mock product id not found: ${id}`);
    return found;
  };
}

// discountPct(0~1) 만큼 할인된 것으로 보이도록 oldPriceWon 을 역산한다.
// 예: priceWon 119000, discountPct 0.2 → oldPriceWon ≈ 148750 (20% 할인 표기).
function withOldPrice(product: LabProduct, discountPct: number): LabProduct {
  return { ...product, oldPriceWon: Math.round(product.priceWon / (1 - discountPct)) };
}
function withIsNew(product: LabProduct): LabProduct {
  return { ...product, isNew: true };
}

// 3~7번 슬롯 정의 — id/title/subtitle/personal(100% 개인화 여부) 만 담는다.
// personal: true 인 슬롯은 hasPersonalData(A/B 토글)가 false 면 화면에서
// 통째로 숨는다(개인화 데이터가 없으면 성립 자체가 안 되는 지면).
//
// 취향저격 아이템(taste-sale-new) 재활성(2026-08-06 사용자 확정, 결정
// 변경) — 세일/신상 정의가 아니라 취향 상위 노드(온보딩) 상품 중
// 인기순(조회·찜·클릭 높은 순), 이미 찜한 것 제외. assembleSlotProducts 의
// 'taste-sale-new' 매핑도 함께 해제됨.
const SLOT_DEFS: Array<{ id: string; title: string; subtitle: string; personal: boolean }> = [
  // 2번 최근 본 상품 — 브랜드 필이 아니라 상품 카드 행(2026-08-04 밤 사용자
  // 확정, 후르츠 3번 문법). 열람 로그를 상품 단위 최근순으로 dedupe.
  // 실서비스 GET /v1/me/recent-products. 탭 → 해당 PDP, 헤더 › → 히스토리.
  // 구좌명·서브 카피 2026-08-05 사용자 확정 (더 이상 가칭 아님).
  {
    id: 'recent-products',
    title: '최근 본 상품',
    subtitle: '다시 볼까요',
    personal: true,
  },
  {
    id: 'discount-wishlist',
    title: '방금 할인된 찜',
    subtitle: '남들도 보고 있어요',
    personal: true,
  },
  // 취향저격 아이템 — 취향 상위 노드 인기순(위 주석 참고).
  {
    id: 'taste-sale-new',
    title: '취향저격 아이템',
    subtitle: '마음에 들 거예요',
    // 취향(온보딩/행동) 데이터 없으면 숨김 — 신규·미온보딩 유저엔 안 뜬다
    // (2026-08-06 사용자). 취향 상위 노드 시드가 있어야 성립하는 지면.
    personal: true,
  },
  {
    id: 'under-100k',
    title: 'Under 100$',
    subtitle: '좋은 옷을 더 좋은 가격으로',
    personal: false,
  },
  // "요즘 많이 찜해요"(순수 상품 찜 집계) 구좌는 2026-08-04 밤 사용자 확정으로
  // 삭제 — 쿼리 타입을 아래 trending-brands 에 병합했다. 찜 집계는 이 구좌의
  // 브랜드당 대표 상품 선정 기준(그 브랜드에서 요즘 가장 많이 찜된 상품)으로
  // 흡수. 인기 축 구좌가 하나가 되면서 브랜드 인기 vs 상품 인기 구좌 간
  // 쿼리 중복 위험이 구조적으로 사라진다.
  {
    id: 'trending-brands',
    title: '요즘 뜨는 브랜드',
    subtitle: '검색량 대폭발',
    personal: false,
  },
  {
    id: 'follow-brands',
    // 타이틀=감정(왜), 서브=기능(어떻게 채워지는지) 역할 분담(사용자 확정).
    title: '내가 좋아하는 브랜드',
    subtitle: '팔로우한 브랜드에서 골라왔어요',
    personal: true,
  },
];

// 슬롯 id → 상품 배열. 슬롯별 mock 규칙(2026-08-04 확정):
//  - recent-products: 5개, 열람 로그 상품 단위 최근순 mock — most-wished
//    삭제로 비워진 id 풀 재사용(구좌 간 중복 없음 유지).
//  - discount-wishlist: 4개, 전부 oldPriceWon(15%↑ 할인) — 찜+가격 diff,
//    알림 트랙과 동일 소스, 크롤 배치 갱신을 가정한 mock.
//  - taste-sale-new: 6개, 전부 일반 상품(세일/신상 표기 없음) — 취향 상위
//    노드(온보딩) 상품 중 인기순(조회·찜·클릭 높은 순), 이미 찜한 것 제외를
//    가정한 mock(2026-08-06 재정의, SLOT_DEFS 상단 주석 참고).
//  - under-100k: 5개, 전부 10만원 미만.
//  - follow-brands: 4개, jaded london 2 + marge sherwood 2 — 팔로우한
//    브랜드의 인기 상품(조회/찜/클릭 높은 순), 신상 개념 없음(크롤 특성상
//    신상 판정이 애매해 2026-08-06 제외, NEW 뱃지도 사용하지 않는다).
//  - trending-brands: 5개, 전부 다른 브랜드 — 브랜드 스코어(찜+검색+팔로우)
//    × 취향 가중으로 브랜드를 뽑고, 브랜드당 대표 1개 = 그 브랜드에서 요즘
//    가장 많이 찜된 상품. 기존 인기/검색량 구좌 + "요즘 많이 찜해요"(찜 집계,
//    2026-08-04 밤 병합 삭제)까지 전부 이 구좌로 통합.
function assembleSlotProducts(catalog: LabProduct[]): Record<string, LabProduct[]> {
  const byId = makeById(catalog);
  return {
    'recent-products': ['p11', 'lab-e1', 'lab-e2', 'lab-e3', 'lab-g5'].map(byId),
    'discount-wishlist': [
      withOldPrice(byId('p6'), 0.2),
      withOldPrice(byId('p9'), 0.2),
      withOldPrice(byId('lab-g3'), 0.2),
      withOldPrice(byId('lab-g2'), 0.2),
    ],
    // 인기순 mock — 세일 취소선/NEW 뱃지 없이 일반 상품 6개(SLOT_DEFS 상단
    // 주석 참고, 2026-08-06 재정의).
    'taste-sale-new': [
      byId('p7'),
      byId('p8'),
      byId('lab-e5'),
      byId('lab-g1'),
      byId('lab-g4'),
      byId('lab-g8'),
    ],
    'under-100k': ['p1', 'p2', 'p3', 'p4', 'p5'].map(byId),
    'follow-brands': [
      byId('lab-jaded-a1'),
      byId('lab-jaded-a2'),
      byId('lab-marge-a1'),
      byId('lab-marge-a2'),
    ],
    'trending-brands': ['p10', 'p12', 'lab-e4', 'lab-g6', 'lab-g7'].map(byId),
  };
}

// 8번(브랜드 픽) 앵커 브랜드 상품 4종 — jaded london, MD 픽 mock.
const BRAND_PICK_PRODUCT_IDS = ['lab-jaded-b1', 'lab-jaded-b2', 'lab-jaded-b3', 'lab-jaded-b4'];

// 9번(몰랐던 브랜드) 상품 4종 — partimento.
const UNKNOWN_BRAND_PRODUCT_IDS = ['lab-part-c1', 'lab-part-c2', 'lab-part-c3', 'lab-part-c4'];

// 1번(메인 배너) — mock 카피 3장. 소재·카피 미확정, 에디토리얼 구성은
// 현규 직접 담당 예정. 외부 이미지 자산 없음 — 뮤트 무지 배경(로컬 상수,
// EXTRA_BRANDS 톤과 어울리게) 위에 타이틀/서브만 얹는다. Liquid Glass 는
// 콘텐츠 레이어라 여기 쓰지 않는다(불투명 배경 카드).
// 메인 배너 = 디자이너가 통짜로 만든 이미지를 그대로 끼우는 방식(2026-08-05
// 사용자 확정). 그래디언트·로고·텍스트·폰트 전부 이미지 안에 포함 — 앱은
// 이미지를 프레임(라운드 + 탭 + 링크)에만 얹는다. 매주 바뀌는 에디토리얼
// (인스타 연계)이라 코드로 그리면 운영 불가 → 어드민이 이미지 + 링크 + alt
// 텍스트만 교체, 재코딩 0.
// 하이브리드(2026-08-05 사용자 확정): 배경 이미지 = 백엔드가 갈아끼움,
// 하단 텍스트(슈퍼타이틀 + 타이틀) = 앱이 코드로 레이아웃 → 문구가 동적으로
// 남아 다국어·A/B·접근성 유지, 디자이너는 배경만 책임. 배경 위 가독성 위해
// 하단 스크림(투명→어둠) 깔고 흰 텍스트.
// export 스펙: 세로 1:1.35(권장 1080×1460 @3x), 모서리 각지게(라운딩은 앱),
// **하단 좌측 텍스트 대비 필수**(2026-08-05): 그림자·스크림을 쓰지 않고
// 애플뮤직처럼 아트워크 대비에 맡기므로, 배경의 하단 좌측(텍스트 자리)은
// 흰 글자가 읽히게 충분히 진하게/채도 있게 디자인할 것. 밝은 배경이 불가피한
// 카드가 나오면 그때만 서브틀 스크림 도입 검토. image=null 이면 mock 플레이스홀더.
// 실서비스: GET /v1/curation banners[] = { imageUrl, link, supertitle, title }.
// 노션 큐레이션 어드민에 메인 배너 구좌 포함 — 이미지 + 텍스트 필드만 추가.
// 글자수 가이드(어드민 필드 제한, 카드 폭 246·17pt 기준): 서브 ≤ 12자(1줄),
// 타이틀 ≤ 18자(2줄 이내, 권장은 애플처럼 짧게). 넘치면 numberOfLines 로
// 잘리므로 어드민에서 막는다.
// [mock 배경] 해 떠오르는 연출 — 하단 중앙에서 따뜻한 오렌지 코어가 올라오는
// radial 글로우(사용자 레퍼런스 재현). react-native-svg 없이 data-URI SVG 로
// 그려 Image 배경에 그대로 얹는다(bellUri 와 동일 기법, 웹 렌더 확실).
// 실서비스에선 이 자리에 백엔드 imageUrl 이 들어온다 — 배경 슬롯 구조 동일.
// hex 의 # 는 data-URI 에서 %23 로 인코딩.
// base64 인코딩 — data-URI 의 gradient url(#) 참조가 utf8 형식에선 깨져서
// (벨 아이콘 같은 단순 stroke 는 되지만) base64 로 확실히 렌더. 실서비스에선
// 이 자리에 백엔드 imageUrl 이 들어오므로 이 상수는 mock 전용.
// 배너 = 흰 바탕 + 하단 방사형 글로우(bannerGlowUri, 색상별) + 좌상단 로고 +
// 하단 좌측 텍스트. 글로우 색만 갈아끼우면 무한 생성(MD). 카피·색 가칭.
type MainBanner = { id: string; supertitle: string; title: string; glow: string; bgUri?: string; logoColor?: string };
// 시안(2026-08-05): 총 3장 = 레드 글로우 + 딥그린 레디얼 링 + 스카이블루 곡선
// 아크(핀터레스트 무드). 닷 그리드는 제외(사용자: 징그러움). 패턴 배경은 어두워
// 로고·텍스트 흰색, 레드 글로우는 흰 바탕이라 로고 검정. 실서비스는 디자이너
// 이미지가 백엔드 배급 — 여기선 코드 SVG로 구성만 확인.
const MAIN_BANNERS: MainBanner[] = [
  { id: 'banner-1', supertitle: '더워요', title: '시원한 여름 휴가 피스', glow: '#FF1F0A', logoColor: 'black' },
  { id: 'banner-2', supertitle: '가볍게 입기', title: '버뮤다 팬츠 셀렉션', glow: '#0B5A3B', bgUri: PATTERN_RING_GREEN, logoColor: 'white' },
  { id: 'banner-3', supertitle: '핀터레스트 무드', title: '스윔웨어 모아보기', glow: '#0B3E7C', bgUri: PATTERN_ARCS_BLUE, logoColor: 'white' },
];

// 유도 칩 (2026-07-14 확정, 성별 이원화) — GET /v1/curation 응답 chips[]와
// 동일 계약. 노출은 한국어(label), 실행은 검증된 영어 쿼리(query) + category
// gate + 온보딩 성별. 칩 = 완전 통제된 입력 → 검증 통과 값만 태운다.
// 골든셋 최종(여 7/13 · 남 7/14) 결론이 성별로 갈린다:
//   여성 = 문형 채택 방식 (무드 95%·소재 90%·핏 85%·컬러 75% — 문형 안에서
//          값 교체 가능). TPO·가격 배제.
//   남성 = 값 화이트리스트 방식 (모든 문형 75% 미달, 최고 60% — 검증 통과
//          값만 개별 등록). 개수도 성별 자유 (여 5 / 남 4).
// 미검증 값은 실제 검색 경로 실행 + top-10 육안 판정 후에만 반영.
const SUGGESTION_CHIPS_WOMEN = [
  { id: 'chip-w1', pattern: 'mood', label: '유니크한 미니백', query: 'quirky unique mini bag', category: 'bag' }, // S 확정 (검증 쿼리 원문, 축약형은 럭셔리 편중)
  { id: 'chip-w2', pattern: 'aesthetic', label: 'Y2K 스타일 탑', query: 'y2k top', category: 'top' }, // 화이트리스트 S
  { id: 'chip-w3', pattern: 'fit', label: '카프리 팬츠', query: 'capri pants', category: 'pants' }, // S (7/14 현규 판정)
  { id: 'chip-w4', pattern: 'fit', label: '로우라이즈 진', query: 'low rise jeans', category: 'jeans' }, // S (7/14 현규 판정)
  { id: 'chip-w5', pattern: 'mood', label: '로맨틱한 원피스', query: 'romantic dress', category: 'dress' }, // S 확정
] as const;

// 남성 4종 — 전부 7/14 현규가 실검색 top-10 육안 판정으로 확정한 값.
const SUGGESTION_CHIPS_MEN = [
  { id: 'chip-m1', pattern: 'fit', label: '크롭 반팔티', query: 'cropped tee', category: 'tee' },
  { id: 'chip-m2', pattern: 'pattern', label: '카모 패턴 카고 팬츠', query: 'camo cargo pants', category: 'pants' },
  { id: 'chip-m3', pattern: 'fit', label: '루즈핏 데님 팬츠', query: 'loose fit denim pants', category: 'jeans' },
  { id: 'chip-m4', pattern: 'aesthetic', label: '여름 인디 밴드 티셔츠', query: 'summer indie band tee', category: 'tee' },
] as const;

// 현재 프로토타입 노출 셋 — 온보딩(OB_01) gender 값이 배선되면
// gender === 'men' ? SUGGESTION_CHIPS_MEN : SUGGESTION_CHIPS_WOMEN 으로 전환.
const SUGGESTION_CHIPS = SUGGESTION_CHIPS_WOMEN;

// 상황별로 찾기 섹션 노출 셋 — 2줄 넘지 않게 4개만(2026-08-05 사용자).
// chip-w4(로우라이즈 진) 제외 = 카프리 팬츠와 fit 중복. 최종 셋은 재설계에서.
const SECTION_QUERY_CHIPS = SUGGESTION_CHIPS.filter((c) => c.id !== 'chip-w4');

// 히어로 = 라지 타이틀 + 데일리 팩트 서브 (2026-08-04 밤 시안 — 선언형 카피
// 로테이션 3종 폐기 검토). 근거: 선언 카피는 재방문자에게 반복 노출로 죽은
// 지면이 되고, 발견의 목소리는 메인 배너가, 초대는 컴포저 플레이스홀더가
// 이미 담당. 애플뮤직 문법 = 상단은 화면명 라지 타이틀 하나.
// 서브는 "매일 새로 도착"을 선언이 아니라 오늘의 실데이터로 증명하는 한 줄 —
// 실서비스는 당일 신상 카운트 쿼리 연동(성별 스코프 반영), mock 고정값.
// 치수 근거: 킷 실측 Toolbars/Titles - iPhone/Large Title = SFPro-Bold 34,
// Large Title and Subtitle 의 서브 = SFPro-Medium 15.

// 컴포저 전송 버튼 탭 시 사용하는 mock 캔드 쿼리.
// 실제 전송/추론은 없음 — UI 상호작용만 시연.
const CANNED_QUERY = '베이지 니트 조끼 찾아줘';

// 전송 payload — display(화면 노출, KO)와 query(API 전송, EN 검증 쿼리)를
// 계약 수준에서 분리한다. 칩은 label≠query 라서 이 분리가 없으면 실연동 때
// 한국어 label 이 임베딩으로 흘러 골든셋 검증이 무효가 된다. 컴포저 자유
// 입력은 display === query (서버 측 rewrite 가 처리). 글로벌 전환 시엔
// label 만 영어로 교체하면 되고 query 검증 자산은 그대로 유지된다.
type SendPayload = { display: string; query: string; chipId?: string };

export default function ExploreLabScreen() {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const catalog = useMemo(() => buildMockCatalog(), []);

  // 시안 전용 A/B 토글 — A=개인화 데이터 없음(신규, 디폴트), B=보유.
  // 커밋 정리 시 제거 대상. 좌하단 플로팅 필로 노출(아래 JSX, abToggle 스타일).
  const [hasPersonalData, setHasPersonalData] = useState(false);
  const insets = useSafeAreaInsets();
  // 웹 미리보기는 safe-area 인셋이 0 → 다이나믹 아일랜드와 겹침. 실기기
  // 상태바 인셋(59)을 웹에서만 심는다 (news-lab/brand-lab 과 동일 처리).
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;

  // 3~7번 슬롯 상품 배정(id 기반, 중복 없음 — SLOT_DEFS 상단 주석 참고).
  const slotProducts = useMemo(() => assembleSlotProducts(catalog), [catalog]);
  const byId = useMemo(() => makeById(catalog), [catalog]);
  // 8번(브랜드 픽) jaded london 앵커 4종, 9번(몰랐던 브랜드) partimento 4종.
  const brandPickProducts = useMemo(() => BRAND_PICK_PRODUCT_IDS.map(byId), [byId]);
  const unknownBrandProducts = useMemo(() => UNKNOWN_BRAND_PRODUCT_IDS.map(byId), [byId]);
  // personal:true 슬롯(최근 본 상품·방금 할인된 찜·팔로우 브랜드)은
  // hasPersonalData=false(A안)면 sections 계산에서 통째로 제외한다.
  // A/B 는 노출 구좌만 다르고 카드 구성·크기 규격은 완전히 동일하다
  // (같은 SLOT_DEFS → CurationRow → 정사각 카드 경로, 2026-08-04 확정).
  const sections = useMemo(
    () =>
      SLOT_DEFS.filter((def) => hasPersonalData || !def.personal).map((def) => ({
        ...def,
        products: slotProducts[def.id],
      })),
    [slotProducts, hasPersonalData],
  );

  const togglePin = (id: string) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleProductPress = (product: Product) => {
    router.push(`/product/${product.id}`);
  };

  const noop = (haptic: () => void) => () => {
    haptic();
  };

  // 전송 = chat-lab 핸드오프(2026-08-04 확정): 제안 칩 탭(검증 쿼리) /
  // 상황 칩 탭 / 컴포저 전송 버튼 탭(캔드 쿼리)이 모두 이 경로를 탄다.
  // 대화를 이 화면에 쌓지 않고 쿼리를 들고 Chat 화면으로 전환한다
  // (뒤로 오면 스크롤 위치 보존).
  const handleSend = (payload: SendPayload) => {
    Haptic.medium();
    router.push({
      pathname: '/chat-lab',
      params: { display: payload.display, query: payload.query },
    });
  };

  // [통합 시안 셸] 배선 — 허브(사이드바)로 진입. /lab-sidebar 는 typed
  // routes 생성 시점 이후 추가된 dev-only 라우트라 캐스팅이 필요하다
  // (sidebar.tsx 의 기존 관례와 동일, 예: router.replace("/home" as never)).
  const handleOpenSidebar = () => {
    Haptic.light();
    router.push('/lab-sidebar' as never);
  };

  // 시안 전용 A/B 토글 핸들러 — 실서비스엔 없음.
  const handleToggleHasPersonalData = () => {
    Haptic.light();
    setHasPersonalData((prev) => !prev);
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          // 헤더-배너 간격 24 — 16은 좁다는 피드백(2026-08-04), 32(구 히어로
          // 시절)는 과함. 중간값 Spacing.four 로 확정.
          { paddingTop: topInset + TOP_PILL_HEIGHT + Spacing.four },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. 메인 배너 — 헤더 없음, 배너 자체가 지면. */}
        <MainBannerCarousel />

        {/* 2~7. SLOT_DEFS 기반 상품 행(CurationRow 재사용) — personal:true
            슬롯(최근 본 상품·방금 할인된 찜·팔로우 브랜드)은 sections 계산
            단계에서 이미 필터링됐다. */}
        {sections.map((section) => (
          <Fragment key={section.id}>
            <CurationRow
              title={section.title}
              subtitle={section.subtitle}
              products={section.products}
              pinnedIds={pinnedIds}
              onPressProduct={handleProductPress}
              onTogglePin={togglePin}
            />
            {/* 7. 상황별로 찾기 — 요즘 뜨는 브랜드 바로 아래(2026-08-04 밤
                사용자 확정): 채팅이 메인 피처라 스크롤 하단이 아니라 디깅
                흐름 중간에서 바로 경험하도록 상향 배치. 칩 탭 → chat-lab
                핸드오프. */}
            {section.id === 'trending-brands' && (
              <SituationalChipsSection onSend={handleSend} />
            )}
          </Fragment>
        ))}

        {/* 9. 브랜드 픽 — 브랜드 배너 카드 + 동일 브랜드 상품 행 페어링. */}
        <BrandPickSection
          products={brandPickProducts}
          pinnedIds={pinnedIds}
          onPressProduct={handleProductPress}
          onTogglePin={togglePin}
        />

        {/* 10. 몰랐던 브랜드 — 브랜드 스포트라이트 + 상품 행. */}
        <UnknownBrandSection
          products={unknownBrandProducts}
          pinnedIds={pinnedIds}
          onPressProduct={handleProductPress}
          onTogglePin={togglePin}
        />

        {/* 11. 상황별로 찾기 — 쿼리 칩 횡스크롤. */}

        <View style={{ height: COMPOSER_CLEARANCE + insets.bottom }} />
      </Animated.ScrollView>

      {/* 상단 플로팅 글래스 필 + 중앙 내비 타이틀 (2026-08-04 밤 시안).
          중앙 타이틀 = 뉴스 탭과 동일 문법(절대 중앙, pointerEvents none,
          headline 17 Semibold, 상시 고정) → 동급 표면(Explore·뉴스) 헤더 통일.
          HIG 근거: Toolbars "sidebar 토글이 leading, 그 다음 view title" +
          "title helps people confirm their location". 15자 미만 규칙 준수.
          (평상시 벨+찜만일 땐 타이틀 여유 ~45pt 로 간섭 없음, 2026-08-04 실측.) */}
      <View style={[styles.topPills, { top: topInset + Spacing.one }]}>
        <View pointerEvents="none" style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>Explore</Text>
        </View>
        <Pressable
          hitSlop={6}
          onPress={handleOpenSidebar}
          accessibilityRole="button"
          accessibilityLabel="메뉴"
        >
          <GlassSurface {...Glass.chip} isInteractive style={styles.iconPill}>
            {Platform.OS === 'web' ? (
              <Text style={styles.menuGlyph}>☰</Text>
            ) : (
              <SymbolView
                name="line.3.horizontal"
                size={20}
                tintColor={IOSColors.label}
                weight="medium"
              />
            )}
          </GlassSurface>
        </Pressable>

        <View style={styles.topPillsRight}>
          {/* 알림 벨 (2026-08-04: 히스토리 필 대체 — 히스토리는 사이드바 최근
              항목이 전담). 뱃지 점이 메인에 상시 보여야 알림함이 산다. */}
          <Pressable
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="알림, 읽지 않은 소식 있음"
            onPress={() => {
              Haptic.light();
              router.push('/notif-inbox-lab' as never);
            }}
          >
            <GlassSurface {...Glass.chip} isInteractive style={styles.iconPill}>
              {Platform.OS === 'web' ? (
                <Image source={{ uri: bellUri('black') }} style={styles.bellIcon} />
              ) : (
                <SymbolView name="bell" size={18} tintColor={IOSColors.label} weight="medium" />
              )}
              <View style={styles.bellDot} />
            </GlassSurface>
          </Pressable>
          <Pressable hitSlop={6} onPress={noop(Haptic.light)}>
            <GlassSurface {...Glass.chip} isInteractive style={styles.textPill}>
              <SymbolView
                name="heart"
                size={16}
                tintColor={IOSColors.label}
                weight="medium"
              />
              <Text style={styles.pillText}>찜</Text>
            </GlassSurface>
          </Pressable>
        </View>
      </View>

      {/* 하단 플로팅 컴포저 — 골든셋 쿼리 칩은 상황별로 찾기 섹션으로 이관
          (2026-08-05). "공용, 가격무관" 스코프 필터 칩은 컴포저 스코프
          컨트롤이라 여기 유지(쿼리 아님 → 이관 대상 아님, 사용자 확정).
          컨트롤 레이어라 GlassSurface Glass.chip 유지. */}
      <View style={[styles.composerArea, { paddingBottom: insets.bottom + Spacing.one }]}>
        <View style={styles.composerFilterRow}>
          <Pressable hitSlop={4} onPress={() => Haptic.selection()}>
            <GlassSurface {...Glass.chip} isInteractive style={[styles.suggestionChip, styles.filterChip]}>
              <Text style={styles.suggestionChipText}>공용, 가격무관</Text>
            </GlassSurface>
          </Pressable>
        </View>
        <ComposerMock onSend={() => handleSend({ display: CANNED_QUERY, query: CANNED_QUERY })} />
      </View>

      {/* 시안 전용 A/B 토글 — A=개인화 데이터 없음(신규), B=보유. 커밋 정리
          시 제거 대상. 라벨은 자식 없는 leaf Text 로 렌더(자동화 캡처가
          텍스트 매칭으로 클릭하기 때문). zIndex 로 컴포저보다 위에 띄운다. */}
      <View style={[styles.abToggle, { bottom: AB_TOGGLE_BOTTOM + insets.bottom }]}>
        <Pressable hitSlop={6} onPress={handleToggleHasPersonalData}>
          <GlassSurface {...Glass.chip} isInteractive style={styles.textPill}>
            <Text style={styles.pillText}>{hasPersonalData ? 'B 개인화' : 'A 신규'}</Text>
          </GlassSurface>
        </Pressable>
      </View>
    </View>
  );
}

// ── CurationRow (3안 — 가로 스크롤 행) ─────────────────────────────────────
// 헤더([타이틀 ›] 공통 규격) → 서브타이틀 → 가로 ScrollView 순. 카드 가로 스크롤
// 영역은 marginHorizontal 음수로 부모의 Spacing.three 인셋을 상쇄한 뒤
// contentContainerStyle 에서 다시 Spacing.three 를 줘서, 첫 카드는 헤더
// 텍스트와 x축이 정확히 맞고 마지막 카드는 화면 진짜 가장자리까지
// 스크롤되도록 한다 (헤더/카드가 어긋나 보이면 그 자체로 craft 결함).
function CurationRow({
  title,
  subtitle,
  products,
  pinnedIds,
  onPressProduct,
  onTogglePin,
}: {
  title: string;
  subtitle: string;
  products: LabProduct[];
  pinnedIds: Set<string>;
  onPressProduct: (product: Product) => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <View style={styles.rowSection}>
      {/* 구좌 헤더 공통 규격 (2026-08-03 확정): [타이틀 ›] — 애플뮤직 문법,
          "더보기" 텍스트 전면 금지. 탭 → 구좌 전체 리스트 (mock). */}
      <Pressable
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={`${title} 전체 보기`}
        onPress={() => Haptic.light()}
        style={styles.rowHeader}
      >
        <Text style={styles.sectionTitle}>{title}</Text>
        {Platform.OS === 'web' ? (
          <Text style={styles.sectionChevron}>›</Text>
        ) : (
          <SymbolView name="chevron.right" size={17} tintColor={IOSColors.secondaryLabel} weight="semibold" />
        )}
      </Pressable>
      {/* 서브 없는 구좌(취향저격 아이템)는 빈 줄을 만들지 않도록 조건부 렌더. */}
      {subtitle !== '' && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowScroll}
        contentContainerStyle={styles.rowScrollContent}
      >
        {products.map((product) => (
          <AnimatedProductCard
            key={product.id}
            product={product}
            pinned={pinnedIds.has(product.id)}
            onPress={() => onPressProduct(product)}
            onPin={() => onTogglePin(product.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── SectionHeader ([타이틀 ›] 공통 규격, 신규 지면용 공용 헤더) ───────────────
// CurationRow 는 내부에 헤더를 직접 그려 건드리지 않는다(기존 구조 유지
// 원칙) — 이 헬퍼는 v1.2 신규 지면(2/8/9/10번)에서만 재사용해 동일한
// [타이틀 ›] 규격을 중복 없이 그린다.
// showChevron=false: 찾는 게 없나요?(칩 클라우드, 드릴다운 리스트 없음) ·
// 트렌딩(배너 지면). 브랜드 픽·몰랐던 브랜드는 배너 안 › 제거(2026-08-05)로
// "이중 셰브런" 사유가 사라져 헤더 › 를 다시 켜 다른 구좌와 통일.
// showChevron=false 인 경우 헤더는 비인터랙티브 텍스트만.
function SectionHeader({
  title,
  accessibilityLabel,
  showChevron = true,
}: {
  title: string;
  accessibilityLabel?: string;
  showChevron?: boolean;
}) {
  if (!showChevron) {
    return (
      <View style={styles.rowHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    );
  }
  return (
    <Pressable
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={() => Haptic.light()}
      style={styles.rowHeader}
    >
      <Text style={styles.sectionTitle}>{title}</Text>
      {Platform.OS === 'web' ? (
        <Text style={styles.sectionChevron}>›</Text>
      ) : (
        <SymbolView name="chevron.right" size={17} tintColor={IOSColors.secondaryLabel} weight="semibold" />
      )}
    </Pressable>
  );
}

// ── MainBannerCarousel (1번 — 메인 배너, 사이즈 체계 1번) ──────────────────
// 세로로 약간 긴 직사각 카드 1.5개 노출 피크 캐러셀 (2026-08-04 확정, 기존
// 풀폭 카드 폐기). 다음 카드가 반쯤 보이는 피크 자체가 스크롤 어포던스라
// 페이지 도트는 두지 않는다 — 애플뮤직 문법. 헤더 없음 — 배너 자체가 지면.
// 이미지 자산이 없어 뮤트 무지 배경(로컬 상수) 위에 타이틀/서브만 얹는
// 콘텐츠 레이어라 Liquid Glass(GlassSurface)를 쓰지 않는다 — HIG §3.4
// "콘텐츠 레이어에 Liquid Glass 금지" 준수. 첫 카드 leading 은 GUTTER 정렬
// (구좌 헤더 x축과 일치) — rowScroll 과 동일한 음수 마진 + contentContainer
// 재인셋 문법.
function MainBannerCarousel() {
  const { width } = useWindowDimensions();
  const cardWidth = bannerCardWidth(width);
  const cardHeight = Math.round(cardWidth * BANNER_CARD_ASPECT);

  return (
    <View style={styles.bannerSection}>
      {/* 상단 배너 섹션 타이틀 "트렌딩"(2026-08-05 사용자) — 헤더리스보다
          의도적으로 보임(애플뮤직 히어로도 섹션명 있음). 드릴다운 리스트가
          없어 › 없음. */}
      <View style={styles.bannerHeader}>
        <SectionHeader title="트렌딩" showChevron={false} />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + CARD_GAP}
        decelerationRate="fast"
        style={styles.rowScrollBleed}
        contentContainerStyle={styles.rowScrollContent}
      >
        {/* 글로우 카드 = 재사용 템플릿 GlowBannerCard(src/components). 배경·로고·
            텍스트 규격은 전부 템플릿이 소유 — 여기선 카피·색·크기만 넘긴다. */}
        {MAIN_BANNERS.map((banner) => (
          <GlowBannerCard
            key={banner.id}
            supertitle={banner.supertitle}
            title={banner.title}
            glow={banner.glow}
            bgUri={banner.bgUri}
            logoColor={banner.logoColor}
            width={cardWidth}
            height={cardHeight}
            onPress={() => Haptic.light() /* mock — 실서비스는 주제 상품 리스트 or 브랜드 홈 랜딩, 인스타 콘텐츠 연계, 노션 어드민 적재 */}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── BrandPickSection (8번 — 브랜드 픽, 사이즈 체계 3번) ────────────────────
// 배너 = 가로 직사각 풀폭 1개(화면−32 × 120) — 카드 사이즈 3종 체계의 3번.
// 헤더 → 브랜드 배너 카드(앵커 브랜드 MD 픽, 주 단위 로테이션 가정) → 동일
// 브랜드 상품 행(rowScroll 재사용, 추가 헤더 없음) — 후르츠 9+10 문법의
// 배너+상품 페어링. 배너도 콘텐츠 레이어라 불투명 배경, GlassSurface 미사용.
function BrandPickSection({
  products,
  pinnedIds,
  onPressProduct,
  onTogglePin,
}: {
  products: LabProduct[];
  pinnedIds: Set<string>;
  onPressProduct: (product: Product) => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <View style={styles.rowSection}>
      <SectionHeader title="브랜드 픽" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowScroll}
        contentContainerStyle={styles.rowScrollContent}
      >
        {products.map((product) => (
          <AnimatedProductCard
            key={product.id}
            product={product}
            pinned={pinnedIds.has(product.id)}
            onPress={() => onPressProduct(product)}
            onPin={() => onTogglePin(product.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── UnknownBrandSection (9번 — 몰랐던 브랜드) ─────────────────────────────
// 브랜드 픽과 동일 배너 카드 구조로 통일(2026-08-05 사용자). 헤더 → 브랜드
// 배너 카드(저인지 브랜드, 브랜드 픽과 다른 뮤트 톤으로 구분) → 상품 행.
// 기존 텍스트 스포트라이트 블록 폐기 — 두 브랜드 지면의 카드 규격을 맞춘다.
function UnknownBrandSection({
  products,
  pinnedIds,
  onPressProduct,
  onTogglePin,
}: {
  products: LabProduct[];
  pinnedIds: Set<string>;
  onPressProduct: (product: Product) => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <View style={styles.rowSection}>
      <SectionHeader title="몰랐던 브랜드" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowScroll}
        contentContainerStyle={styles.rowScrollContent}
      >
        {products.map((product) => (
          <AnimatedProductCard
            key={product.id}
            product={product}
            pinned={pinnedIds.has(product.id)}
            onPress={() => onPressProduct(product)}
            onPin={() => onTogglePin(product.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── SituationalChipsSection (7번 — 상황별로 찾기) ──────────────────────────
// 가로 슬라이드 없이 wrap 클라우드로 1~2줄에 다 노출, 탭 즉시 검색(2026-08-05
// 사용자 확정). 컴포저의 골든셋 쿼리 칩(SUGGESTION_CHIPS, EN query 계약)만
// 이관 — 검증 안 된 상황 칩(하객룩 등)은 제외(백로그: 골든셋 검증 후 추가).
// 칩은 콘텐츠 레이어라 Liquid Glass(GlassSurface)가 아니라 평면 filled 캡슐
// (secondarySystemFill) — HIG §3.4 "Liquid Glass 는 컨트롤·내비 레이어 전용".
// 애플 검색 제안 칩(사진·지도)은 가로 스크롤이지만, 스크롤을 안 쓰는 고정
// 소수 세트라 wrap 캡슐이 정합. 실서비스: GET /v1/curation chips[] 계약.
function SituationalChipsSection({ onSend }: { onSend: (payload: SendPayload) => void }) {
  return (
    <View style={styles.rowSection}>
      <SectionHeader title="찾는 게 없나요?" showChevron={false} />
      <View style={styles.chipCloud}>
        {/* 2줄 넘지 않게 검증 칩 4개만 노출(2026-08-05 사용자: 욱여넣지 말 것).
            카테고리 다양성 위해 로우라이즈 진(chip-w4, 카프리와 같은 fit) 제외.
            전체 골든셋은 SUGGESTION_CHIPS — 최종 셋은 상황별로 찾기 재설계에서. */}
        {SECTION_QUERY_CHIPS.map((chip) => (
          <Pressable
            key={chip.id}
            hitSlop={4}
            onPress={() => onSend({ display: chip.label, query: chip.query, chipId: chip.id })}
            style={styles.queryChip}
          >
            <Text style={styles.queryChipText}>{chip.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ── AnimatedProductCard (3안 — press-scale 래퍼) ──────────────────────────
// ProductCard 는 내부적으로 이미지 영역에만 자체 Pressable(내비게이션용)을
// 갖고 있다 — 그 컴포넌트는 건드리지 않는다는 규칙이 있어 press-scale 은
// 바깥에서 얹는다. 구조: 스케일을 구동하는 바깥 Pressable(onPressIn/
// onPressOut 만 사용, onPress 는 주지 않는다) → Animated.View(transform) →
// ProductCard(내비게이션은 ProductCard 자체의 onPress prop 이 그대로 처리).
// unstable_pressDelay={0} 로 RN 의 스크롤뷰 내 프레스 인식 지연을 없애
// 스크롤 중 우발적 트리거 없이도 press-in 이 즉시 반응하게 한다.
//
// 알려진 타협점(RN Pressability 소스로 확인, 실기기 미검증): 중첩된
// Pressable 트리에서 responder 협상은 "터치 지점에서 가장 깊은 노드"부터
// 시작해 그 노드가 onStartShouldSetResponder=true 를 반환하면 그 자리에서
// 즉시 확정된다 — 부모까지 굳이 물어보지 않는다. ProductCard 내부 이미지
// Pressable 이 바깥 래퍼보다 깊으므로, 사진 영역을 직접 누르면 안쪽이
// responder 를 가져가 바깥 Pressable 의 onPressIn 이 오지 않을 수 있다.
// 반대로 사진 밖(브랜드명/상품명 텍스트, 카드 여백)을 누르면 바깥
// Pressable 이 유일한 후보라 press-scale 이 확실히 반응한다. 어느 경우든
// 내비게이션은 항상 정상 동작한다 — ProductCard 의 onPress 는 바깥
// 래퍼와 완전히 독립적으로 그대로 살아있기 때문. 실기기/웹에서 사진
// 영역 tap 시 스케일이 안 보인다면 이 트레이드오프이니, ProductCard
// 자체를 수정해 내부 Pressable 에도 press 상태를 끌어올려야 완전히
// 해소된다(이번 작업 범위에서는 product-card.tsx 를 건드리지 않기로
// 했으므로 보류).
function AnimatedProductCard({
  product,
  pinned,
  onPress,
  onPin,
}: {
  product: LabProduct;
  pinned: boolean;
  onPress: () => void;
  onPin: () => void;
}) {
  // 사이즈 체계 2번(정사각 2.5개 노출) — 이 래퍼가 모든 상품 행(슬롯 3~8,
  // 브랜드 픽 하단 행, 몰랐던 브랜드 행, 대화 mock 행)의 유일한 카드 진입점
  // 이라 여기서 한 번만 계산해 ProductCard.size 로 배선한다.
  const { width: windowWidth } = useWindowDimensions();
  const cardSize = squareCardWidth(windowWidth);
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // press-in 에서 즉시 반응, press-out(release) 이 아니라 press-in 시점에
  // 반응한다 — Apple "Designing Fluid Interfaces" §1, 터치 다운의 순간에
  // 피드백이 없으면 인터페이스가 "죽어있는" 느낌을 준다.
  const handlePressIn = () => {
    scale.value = withSpring(0.97, Motion.snappy);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, Motion.snappy);
  };

  return (
    <Pressable unstable_pressDelay={0} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={scaleStyle}>
        <ProductCard
          product={product}
          size={cardSize}
          oldPriceWon={product.oldPriceWon}
          isNew={product.isNew}
          pinned={pinned}
          onPress={onPress}
          onPin={onPin}
          /* 브랜드명 탭 → 브랜드 홈 (시안: 단일 mock 브랜드로) */
          onBrandPress={() => {
            Haptic.light();
            router.push('/brand-lab' as never);
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

// ── ComposerMock ─────────────────────────────────────────────────────────
// placeholder 로테이션 (2026-07-14 확정) — 컴포저에 말·이미지·링크가 다
// 들어간다는 걸 알리는 3종. ①은 피드 종착점("찾는 게 없네" 순간)을 검색으로
// 전환하는 트리거 겸함. 로그인 시 ①은 "OO님," 프리픽스 — home.tsx 통합 때 반영.
const COMPOSER_PLACEHOLDERS = [
  '찾는 옷이 안 보이면, 말만 하세요',
  '이미지/링크로 시작해보세요',
  '사진 한 장이면 충분해요',
];

function ComposerMock({ onSend }: { onSend: () => void }) {
  const placeholder = useMemo(
    () => COMPOSER_PLACEHOLDERS[Math.floor(Math.random() * COMPOSER_PLACEHOLDERS.length)],
    [],
  );
  return (
    <GlassSurface {...Glass.composer} style={styles.composer}>
      <Text style={styles.composerPlaceholder} numberOfLines={1}>
        {placeholder}
      </Text>
      <Pressable hitSlop={6} onPress={onSend} style={styles.sendBtn}>
        {/* 버튼 배경이 IOSColors.label(라이트=검정/다크=흰색)이라 아이콘은
            반대로 적응하는 systemBackground 를 써서 라이트/다크 모두 대비를
            보장한다 — 리터럴 흰색 하드코딩을 피한다. */}
        <SymbolView name="arrow.up" size={16} tintColor={IOSColors.systemBackground} weight="bold" />
      </Pressable>
    </GlassSurface>
  );
}

// ── 레이아웃 상수 (구조적 수치 — 하드코딩 예외 대상) ───────────────────────
const TOP_PILL_HEIGHT = 40;
const COMPOSER_CLEARANCE = 140;

// A/B 데브 토글 — 컴포저 영역 위에 띄우는 위치(구 점프 버튼 자리 재사용).
const AB_TOGGLE_BOTTOM = COMPOSER_CLEARANCE + Spacing.two;

// ── 카드 사이즈 3종 체계 (애플뮤직 문법, 2026-08-04 확정) ─────────────────
// ① 세로 직사각 1.5개 노출(메인 배너) ② 정사각 2.5개 노출(모든 상품 카드)
// ③ 가로 직사각 풀폭 1개(브랜드 픽 배너). 이 3종 외 카드 사이즈 금지.
// 노출 개수는 화면폭 기반 계산 — GUTTER(화면 좌측 인셋) 와 카드 사이 갭을
// 빼고 나눠 "다음 카드가 반쯤 보이는" 피크가 항상 성립한다.
const GUTTER = Spacing.three; // 16 — scrollContent 좌우 인셋과 동일
const CARD_GAP = Spacing.two; // 8 — rowScrollContent gap 과 동일 값 재사용
// 계산 기준 폭은 폰 최대폭(430, 아이폰 Pro Max 급)으로 캡 — 데스크톱 웹
// 미리보기에서 비율 카드가 화면만큼 거대해지는 것 방지. 실기기(<=430)에선
// 항상 실제 화면폭이 쓰인다.
const PHONE_MAX_WIDTH = 430;
const layoutWidth = (windowWidth: number) => Math.min(windowWidth, PHONE_MAX_WIDTH);
// ① 배너: 1.5개 노출, 세로로 약간 긴 비율(폭×1.35).
const bannerCardWidth = (windowWidth: number) =>
  Math.round((layoutWidth(windowWidth) - GUTTER - CARD_GAP) / 1.5);
// ② 상품: 정사각, 2.5개 노출 (393pt 기준 약 144).
const squareCardWidth = (windowWidth: number) =>
  Math.round((layoutWidth(windowWidth) - GUTTER - CARD_GAP * 2) / 2.5);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.systemBackground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
  },

  // 중앙 내비 타이틀 (뉴스 탭과 동일 — headline 17 Semibold, 절대 중앙).
  navTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  navTitle: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },

  // 구좌 헤더 공통 규격 — Prominent 20 Semibold (브랜드 홈과 동일).
  sectionTitle: {
    ...IOSText.title3,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  // 셰브런 광학 보정 — › 글리프는 폰트 크기 대비 작게 그려져서, 타이틀
  // 20pt와 눈높이가 같아 보이려면 글리프를 키워야 함 (애플뮤직 관찰 기준).
  // 웹 전용 글리프 광학 보정 (실기기는 SF Symbol chevron.right).
  sectionChevron: {
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    transform: [{ translateY: -2 }],
  },
  sectionSubtitle: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: Spacing.half,
    fontFamily: IOSFont.sans,
  },

  // CurationRow (3안 가로 스크롤)
  rowSection: {
    marginBottom: Spacing.five,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  rowScroll: {
    marginTop: Spacing.three,
    // 부모(scrollContent)의 Spacing.three 좌우 인셋을 상쇄 — 카드가
    // 헤더 텍스트와 같은 x 에서 시작하면서도 화면 진짜 가장자리까지
    // 스크롤될 수 있도록 한다 (contentContainerStyle 에서 다시 인셋).
    marginHorizontal: -Spacing.three,
  },
  rowScrollContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },

  // Top pills
  topPills: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topPillsRight: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  bellIcon: {
    width: 20,
    height: 20,
  },
  // 뱃지 점 — 필 우상단 코너 8px systemRed (글리프 침범 금지, iOS 표준 dot).
  bellDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemRed,
  },
  menuGlyph: {
    fontSize: 17,
    lineHeight: 18,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  iconPill: {
    width: TOP_PILL_HEIGHT,
    height: TOP_PILL_HEIGHT,
    borderRadius: RadiusRole.chip,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  textPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    height: TOP_PILL_HEIGHT,
    paddingHorizontal: Spacing.three,
    borderRadius: RadiusRole.chip,
    overflow: 'hidden',
  },
  pillText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },

  // Composer + suggestion chips
  composerArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
  },
  // 상황별로 찾기(10번) — 가로 슬라이드 대신 flexWrap 클라우드로 모든 칩을
  // 한 화면에 노출(2026-08-05). rowScroll 과 달리 스크롤 엣지 블리드가
  // 필요 없어 marginHorizontal 상쇄가 없다 — 부모 scrollContent 의
  // paddingHorizontal(16)을 그대로 상속해 헤더 타이틀과 동일 x축에 정렬한다
  // (자체 paddingHorizontal 추가 시 이중 인셋으로 헤더와 어긋남 — craft 결함).
  chipCloud: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  // 상황별로 찾기 검증 칩 — 애플 캡슐 규격(2026-08-05 사용자: 애플 스타일
  // 준수). 높이 34(blueprints Buttons/Medium 34) · 완전 라운드 캡슐 · 좌우
  // 패딩 14(iOS 필터 칩 관례) · 텍스트 subhead 15 Semibold. 콘텐츠 레이어라
  // Liquid Glass 아닌 평면 filled(secondarySystemFill) — HIG §3.4.
  queryChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: RadiusRole.chip,
    backgroundColor: IOSColors.secondarySystemFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  queryChipText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  // 컴포저 스코프 필터 칩("공용, 가격무관") — 컨트롤 레이어라 GlassSurface
  // 위에 얹는 내용 스타일. 컴포저 입력창 위에 좌측 정렬 단독 노출.
  composerFilterRow: {
    flexDirection: 'row',
    marginBottom: Spacing.two,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: RadiusRole.chip,
    overflow: 'hidden',
  },
  filterChip: {
    // 스코프 필터 — 선택 상태 힌트가 필요하면 여기에 tint 추가(현재 mock).
  },
  suggestionChipText: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  // home.tsx 컴포저와 동일 수치 (56/44 — 2026-07-14 크기 정렬)
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderRadius: RadiusRole.chip,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    overflow: 'hidden',
  },
  composerPlaceholder: {
    ...IOSText.body,
    flex: 1,
    color: IOSColors.placeholderText,
    fontFamily: IOSFont.sans,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 시안 전용 A/B 토글 — 좌하단, 컴포저보다 위(zIndex).
  abToggle: {
    position: 'absolute',
    left: Spacing.three,
    zIndex: 20,
  },

  // 1. MainBannerCarousel — 콘텐츠 레이어(불투명 배경, GlassSurface 미사용).
  // 사이즈 체계 1번(세로 직사각 1.5개 노출) — 폭/높이는 JSX 인라인
  // (bannerCardWidth × BANNER_CARD_ASPECT). 페이지 도트 없음(피크가 어포던스).
  bannerSection: {
    marginBottom: Spacing.five,
  },
  // 배너 섹션 헤더 — 카드는 rowScrollBleed(가장자리까지)지만 헤더는 GUTTER 정렬.
  // 타이틀↔배너 간격은 다른 구좌 헤더↔콘텐츠(rowScroll marginTop 16)와 동일하게
  // 16 — 8 은 트렌딩만 붙어 보여 정합 맞춤(2026-08-05 사용자).
  bannerHeader: {
    marginBottom: Spacing.three,
  },
  // rowScroll 과 동일한 좌우 블리드(음수 마진) — marginTop 없이 쓰는
  // 배너/헤더리스 지면용 변형.
  rowScrollBleed: {
    marginHorizontal: -Spacing.three,
  },
});
