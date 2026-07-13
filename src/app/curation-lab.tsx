/**
 * 3안(문구 상단 + 큐레이션 Row) 프로토타입.
 *
 * `/curation-lab` 경로에서 열람 가능. 어디에서도 링크되지 않는 dev-only
 * 화면이며, 내비게이션(sidebar, tab 등)에 절대 연결하지 않는다.
 *
 * 히어로 = 타이틀 온리 (카드/그래디언트 실험 폐기). 흰 배경 위에 좌측
 * 정렬된 타이틀 텍스트만 렌더링. 스크롤 연동 opacity/scale 애니메이션은
 * 유지하며, transformOrigin 'top left'로 축소 중심을 좌상단에 고정한다.
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
import { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  scrollTo,
  useAnimatedReaction,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { PRODUCT_CARD_WIDTH, ProductCard } from '@/components/product-card';
import {
  Duration,
  Glass,
  Haptic,
  IOSColors,
  IOSFont,
  IOSText,
  Motion,
  Radius,
  RadiusRole,
  Spacing,
} from '@/theme';
import { MOCK_PRODUCTS, type Product } from '@/state/products';

// ── Mock 데이터 확장 ─────────────────────────────────────────────────────
// products.ts 의 MOCK_PRODUCTS 는 12개뿐 — 3섹션(4~6개씩) 채우기 위해
// 로컬에서 id/브랜드/가격/colorHint 를 바꿔 복제한다. products.ts 는 건드리지 않음.
const EXTRA_BRANDS = [
  { brand: 'mmlg', name: '와이드 팬츠', priceWon: 58000, colorHint: '#C7B7A3' },
  { brand: 'thisisneverthat', name: '헤비 후디', priceWon: 89000, colorHint: '#A9A9AE' },
  { brand: 'partimento', name: '니트 베스트', priceWon: 66000, colorHint: '#D8CBBB' },
  { brand: 'salt&paper', name: '스트라이프 셔츠', priceWon: 54000, colorHint: '#B9C4C9' },
  { brand: 'ader error', name: '그래픽 맨투맨', priceWon: 98000, colorHint: '#CBB8C2' },
  { brand: 'hidden nyc', name: '카고 팬츠', priceWon: 112000, colorHint: '#9B9C95' },
];

function buildMockCatalog(): Product[] {
  const extras: Product[] = EXTRA_BRANDS.map((item, i) => ({
    id: `lab-${i + 1}`,
    brand: item.brand,
    name: item.name,
    priceWon: item.priceWon,
    colorHint: item.colorHint,
  }));
  return [...MOCK_PRODUCTS, ...extras];
}

// 구좌 4종 — 인기/검색량/가격대/자유 큐레이션 (취향 데이터 0 가정, 7/13 확정). 실데이터 API 연동 전 mock.
const SECTION_DEFS = [
  { title: '지금 인기 브랜드', subtitle: '키코에서 가장 사랑받는 브랜드' },
  { title: '요즘 많이 찾는 브랜드', subtitle: '검색량이 빠르게 오르는 중' },
  { title: 'Under $100', subtitle: '10만원 아래, 안목은 그대로' },
  { title: '지금 뜨는 베트남 핫걸 ST', subtitle: '사이공 트렌드세터의 여름 무드' },
];

// 유도 칩 (2026-07-14 확정) — GET /v1/curation 응답 chips[]와 동일 계약.
// 골든셋 1차 판정 기준 선별: 무드(95%)·소재(90%)·핏(85%)·컬러(75%) 채택,
// TPO·가격은 칩 배제(가격은 v6 RPC 미지원 = 100% 실패). 노출은 한국어(label),
// 실행은 검증된 영어 쿼리(query) + category gate + 온보딩 성별.
// 칩 = 완전 통제된 입력 → 골든셋 통과 값만 태운다. 미검증 값은
// scripts/goldenset/run_goldenset.py 배치 검증 후 반영.
const SUGGESTION_CHIPS = [
  { id: 'chip-1', pattern: 'mood', label: '유니크한 미니백', query: 'unique mini bag', category: 'bag' }, // S 확정
  { id: 'chip-2', pattern: 'aesthetic', label: 'Y2K 스타일 탑', query: 'y2k top', category: 'top' }, // 화이트리스트 S
  { id: 'chip-3', pattern: 'fit', label: '카프리 팬츠', query: 'capri pants', category: 'pants' }, // 검증 대기
  { id: 'chip-4', pattern: 'fit', label: '로우라이즈 진', query: 'low rise jeans', category: 'jeans' }, // 판정 확인 대기
  { id: 'chip-5', pattern: 'mood', label: '로맨틱한 원피스', query: 'romantic dress', category: 'dress' }, // S 확정
] as const;

// [시안 확인용 — 커밋 금지] home.tsx 최장 문구(이름 변형)로 줄바꿈·들여쓰기 확인 중.
// 원본: '머릿속 그 옷,\n마법처럼 찾아드릴게요'
// 히어로 카피 풀 — 핵심가치를 하나씩 말하는 표제 3종을 마운트마다 랜덤 로테이션.
// ① 발견: 인디 브랜드 풀·신선함(매일 갱신 = 사실) ② 취향: 발견·취향 매칭
// ③ 목적: v1.0 시그니처 재사용 — '마법'이 구체적 능력(머릿속 옷 찾기)에 붙은 원형.
// 로그인 시 ②는 이름 치환("OO님이 몰랐던") — home.tsx 통합 때 반영.
const HERO_GREETINGS = [
  '몰랐던 브랜드가\n매일 새로 도착해요',
  '당신이 몰랐던\n취향저격 브랜드',
  '머릿속 그 옷,\n마법처럼 찾아드릴게요',
];

// 컴포저 전송 버튼 탭 시 사용하는 mock 캔드 쿼리 & 에이전트 응답 문구.
// 실제 전송/추론은 없음 — UI 상호작용만 시연.
const CANNED_QUERY = '베이지 니트 조끼 찾아줘';
const AGENT_REPLY_TEXT = '이런 거 어때? 골라봐';

export default function CurationLabScreen() {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const catalog = useMemo(() => buildMockCatalog(), []);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // 3안 히어로의 스크롤 연동 축소 애니메이션이 읽는 원시 스크롤 offset.
  // 타이머/트리거 기반이 아니라 스크롤 값에 1:1로 물려 있어야
  // interruptible(언제든 손가락을 떼거나 방향을 바꿔도 그 즉시 반응) 하다 —
  // Apple "Designing Fluid Interfaces" §3. useAnimatedScrollHandler 는
  // UI 스레드(웹에서는 JS 스레드)에서 매 스크롤 이벤트마다 동기적으로
  // shared value 를 갱신하므로 별도 딜레이가 없다.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  // ── discovery↔chat 공존: mock 대화 ──────────────────────────────────────
  // 실제 전송/추론 없이 UI 상호작용만 시연하는 로컬 상태. 칩 탭/전송 버튼
  // 탭이 대화 블록을 append 하고, 큐레이션 영역과 같은 스크롤 안에 공존한다.
  const [conversation, setConversation] = useState<{ id: string; query: string }[]>([]);
  const [jumpButtonVisible, setJumpButtonVisible] = useState(false);

  // reanimated 4 의 scrollTo(animatedRef, x, y, animated) 로 큐레이션↔대화
  // 사이를 프로그래밍적으로 스크롤한다 — web(react-native-web)에서도
  // 동작하는 경로(scrollTo.web.ts 가 animatedRef() 로 얻은 엘리먼트에
  // scrollView.scrollTo 를 직접 호출)라서 별도 분기 없이 그대로 쓴다.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // 대화 컨테이너의 y offset. UI 스레드에서 읽는 점프 버튼 가시성 계산
  // (useAnimatedReaction/useAnimatedStyle)엔 shared value 미러가, JS
  // 스레드에서 쓰는 scrollTo 타깃 계산엔 plain ref 미러가 필요해 둘 다
  // onLayout 에서 같이 갱신한다.
  const conversationY = useSharedValue(Number.MAX_SAFE_INTEGER);
  const conversationYRef = useRef(0);

  // 전송 직후엔 대화 컨테이너 레이아웃이 아직 없거나(첫 전송 = 이때 처음
  // 마운트) 새 블록 높이가 반영 전이라, setTimeout(0) 시점의 y 는 stale 하다
  // (첫 전송 시 0 → 최상단으로 튀는 버그). 스크롤 의도를 ref 에 걸어두고
  // onLayout(마운트/높이 변화 시 재발화)에서 실제 스크롤을 수행한다.
  const pendingScrollRef = useRef<'none' | 'first' | 'end'>('none');

  const handleConversationLayout = (event: LayoutChangeEvent) => {
    const y = event.nativeEvent.layout.y;
    conversationYRef.current = y;
    conversationY.value = y;
    if (pendingScrollRef.current === 'none') return;
    const mode = pendingScrollRef.current;
    pendingScrollRef.current = 'none';
    requestAnimationFrame(() => {
      if (mode === 'first') {
        scrollTo(scrollRef, 0, Math.max(y - CONVERSATION_TOP_CLEARANCE, 0), true);
      } else {
        scrollRef.current?.scrollToEnd?.({ animated: true });
      }
    });
  };

  // 점프 버튼(↓)의 pointerEvents 는 style 로 애니메이션할 수 없으니
  // useAnimatedReaction + runOnJS 로 React state 를 미러링한다 — opacity 는
  // 아래 useAnimatedStyle 에서 scrollY 를 직접 읽어 별도로 처리한다.
  useAnimatedReaction(
    () =>
      conversation.length > 0 &&
      scrollY.value < conversationY.value - windowHeight * JUMP_BUTTON_VISIBILITY_RATIO,
    (visible, previous) => {
      if (visible !== previous) {
        runOnJS(setJumpButtonVisible)(visible);
      }
    },
  );

  const jumpButtonStyle = useAnimatedStyle(() => {
    const visible =
      conversation.length > 0 &&
      scrollY.value < conversationY.value - windowHeight * JUMP_BUTTON_VISIBILITY_RATIO;
    return {
      opacity: withTiming(visible ? 1 : 0, { duration: Duration.fast }),
    };
  });

  // [큐레이션] 복귀 필 — 대화 존재 여부가 아니라 스크롤 위치 기준으로
  // 노출한다: 큐레이션 구좌의 95% 이상이 뷰포트 위로 지나갔을 때만 등장,
  // 다시 위로 올라와 큐레이션이 화면에 많이 보이면 자동으로 줄어들며
  // 사라진다. scrollY 직결이라 스크롤 도중 잡아도 즉시 역방향 반응.
  const [curationPillVisible, setCurationPillVisible] = useState(false);
  useAnimatedReaction(
    () =>
      conversation.length > 0 &&
      scrollY.value > conversationY.value * CURATION_PILL_REVEAL_RATIO,
    (visible, previous) => {
      if (visible !== previous) {
        runOnJS(setCurationPillVisible)(visible);
      }
    },
  );
  const curationPillStyle = useAnimatedStyle(() => {
    const visible =
      conversation.length > 0 &&
      scrollY.value > conversationY.value * CURATION_PILL_REVEAL_RATIO;
    return {
      // scale 폭을 0.85→0.96 으로 줄임 — 팝하는 느낌 없이 은은하게 (과함 피드백)
      opacity: withTiming(visible ? 1 : 0, { duration: Duration.fast }),
      transform: [
        { scale: withTiming(visible ? 1 : 0.96, { duration: Duration.fast }) },
      ],
    };
  });

  // 4~5개씩 4섹션으로 분배 (5, 4, 5, 4 = 18개)
  const sections = useMemo(() => {
    const chunks = [5, 4, 5, 4];
    let startIdx = 0;
    return SECTION_DEFS.map((def, i) => {
      const chunkSize = chunks[i];
      const products = catalog.slice(startIdx, startIdx + chunkSize);
      startIdx += chunkSize;
      return {
        ...def,
        products,
      };
    }).filter((s) => s.products.length > 0);
  }, [catalog]);

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

  // mock 전송: 제안 칩 탭(칩 라벨을 쿼리로) 또는 컴포저 전송 버튼 탭(캔드
  // 쿼리)이 모두 이 경로를 탄다. 첫 전송은 대화 시작점으로, 이후 전송은
  // 최신 블록이 보이도록 맨 끝으로 스크롤 — 실행은 onLayout 쪽에서.
  const handleSend = (query: string) => {
    Haptic.medium();
    const isFirstMessage = conversation.length === 0;
    // 스크롤은 여기서 직접 하지 않는다 — 새 블록의 레이아웃이 커밋되면
    // handleConversationLayout 이 pendingScrollRef 를 읽어 수행한다.
    pendingScrollRef.current = isFirstMessage ? 'first' : 'end';
    setConversation((prev) => [...prev, { id: `conv-${prev.length}-${Date.now()}`, query }]);
  };

  const handleJumpToTop = () => {
    Haptic.light();
    scrollTo(scrollRef, 0, 0, true);
  };

  const handleJumpToConversation = () => {
    Haptic.light();
    // 대화 시작점이 아니라 맨 아래(최신 블록)까지 완전히 내려간다.
    scrollRef.current?.scrollToEnd?.({ animated: true });
  };

  return (
    <View style={styles.root}>
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + TOP_PILL_HEIGHT + Spacing.two },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
      >
        <Hero3 windowHeight={windowHeight} scrollY={scrollY} />

        {sections.map((section) => (
          <CurationRow
            key={section.title}
            title={section.title}
            subtitle={section.subtitle}
            products={section.products}
            pinnedIds={pinnedIds}
            onPressProduct={handleProductPress}
            onTogglePin={togglePin}
          />
        ))}

        {/* discovery↔chat 공존 — mock 대화가 큐레이션 아래로 append 된다 */}
        {conversation.length > 0 && (
          <View onLayout={handleConversationLayout} style={styles.conversationContainer}>
            {conversation.map((entry, index) => (
              <ConversationBlock
                key={entry.id}
                query={entry.query}
                products={pickConversationProducts(catalog, index)}
                pinnedIds={pinnedIds}
                onPressProduct={handleProductPress}
                onTogglePin={togglePin}
              />
            ))}
          </View>
        )}

        <View style={{ height: COMPOSER_CLEARANCE + insets.bottom }} />
      </Animated.ScrollView>

      {/* 상단 플로팅 글래스 필 */}
      <View style={[styles.topPills, { top: insets.top + Spacing.one }]}>
        <Pressable hitSlop={6} onPress={noop(Haptic.light)}>
          <GlassSurface {...Glass.chip} isInteractive style={styles.iconPill}>
            <SymbolView
              name="line.3.horizontal"
              size={20}
              tintColor={IOSColors.label}
              weight="medium"
            />
          </GlassSurface>
        </Pressable>

        <View style={styles.topPillsRight}>
          {conversation.length > 0 && (
            // 스크롤 위치 기반 노출 — opacity/scale 은 curationPillStyle 이
            // scrollY 를 직접 읽어 처리하고, 탭 가능 여부는 state 미러로 제어.
            <Animated.View
              style={curationPillStyle}
              pointerEvents={curationPillVisible ? 'auto' : 'none'}
            >
              <Pressable hitSlop={6} onPress={handleJumpToTop}>
                <GlassSurface {...Glass.chip} isInteractive style={styles.textPill}>
                  <SymbolView
                    name="sparkles"
                    size={16}
                    tintColor={IOSColors.label}
                    weight="medium"
                  />
                  <Text style={styles.pillText}>큐레이션</Text>
                </GlassSurface>
              </Pressable>
            </Animated.View>
          )}
          <Pressable hitSlop={6} onPress={noop(Haptic.light)}>
            <GlassSurface {...Glass.chip} isInteractive style={styles.textPill}>
              <SymbolView
                name="list.bullet"
                size={16}
                tintColor={IOSColors.label}
                weight="medium"
              />
              <Text style={styles.pillText}>히스토리</Text>
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

      {/* 대화 시작점으로 돌아가는 점프 버튼 — 대화가 있고, 사용자가
          큐레이션 영역까지 위로 스크롤해 있을 때만 노출된다. */}
      <Animated.View
        style={[styles.jumpButton, { bottom: JUMP_BUTTON_BOTTOM + insets.bottom }, jumpButtonStyle]}
        pointerEvents={jumpButtonVisible ? 'auto' : 'none'}
      >
        <Pressable hitSlop={6} onPress={handleJumpToConversation}>
          <GlassSurface {...Glass.chip} isInteractive style={styles.jumpButtonGlass}>
            <SymbolView name="chevron.down" size={16} tintColor={IOSColors.label} weight="medium" />
          </GlassSurface>
        </Pressable>
      </Animated.View>

      {/* 하단 플로팅 컴포저 */}
      <View style={[styles.composerArea, { paddingBottom: insets.bottom + Spacing.one }]}>
        <SuggestionChips onSend={handleSend} />
        <ComposerMock onSend={() => handleSend(CANNED_QUERY)} />
      </View>
    </View>
  );
}

// ── Hero3 (타이틀 온리) ──────────────────────────────────────────────────
// 글래스 카드/그래디언트 실험을 폐기. 타이틀 텍스트를 흰 배경 위에 좌측
// 정렬된 상태로만 렌더링한다.
//
// 스크롤 연동 축소: opacity/scale 을 스크롤 offset(y) 에 직접 보간
// (interpolate) 한다 — 트리거 애니메이션이 아니라 스크롤 값 그 자체가
// 소스이므로 손가락을 아무 때나 반대로 움직이면 그 즉시 자연스럽게
// 역재생된다 (Apple "Designing Fluid Interfaces" §3, 인터럽트 가능성).
// transformOrigin: 'top left' 로 축소 중심을 좌상단에 고정 — 콘텐츠가
// 좌측 정렬이므로 축소 시에도 왼쪽 기준선이 흔들리지 않아야 한다.
function Hero3({
  windowHeight,
  scrollY,
}: {
  windowHeight: number;
  scrollY: SharedValue<number>;
}) {
  // 마운트당 1회 랜덤 선택 — home.tsx 의 기존 로테이션 관례와 동일.
  const greeting = useMemo(
    () => HERO_GREETINGS[Math.floor(Math.random() * HERO_GREETINGS.length)],
    [],
  );
  const heroStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, HERO_SCROLL_RANGE],
      [1, HERO_MIN_OPACITY],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      scrollY.value,
      [0, HERO_SCROLL_RANGE],
      [1, HERO_MIN_SCALE],
      Extrapolation.CLAMP,
    );
    return {
      opacity,
      transform: [{ scale }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.hero3,
        { paddingTop: windowHeight * HERO_TOP_ANCHOR_RATIO, transformOrigin: 'top left' },
        heroStyle,
      ]}
    >
      <Text style={styles.heroTitleManifesto} numberOfLines={2}>
        {greeting}
      </Text>
    </Animated.View>
  );
}

// ── CurationRow (3안 — 가로 스크롤 행) ─────────────────────────────────────
// 헤더(타이틀 + 더보기) → 서브타이틀 → 가로 ScrollView 순. 카드 가로 스크롤
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
  products: Product[];
  pinnedIds: Set<string>;
  onPressProduct: (product: Product) => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <View style={styles.rowSection}>
      <View style={styles.rowHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Pressable hitSlop={6} onPress={() => Haptic.light()}>
          <Text style={styles.rowMoreText}>더보기</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionSubtitle}>{subtitle}</Text>

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

// ── ConversationBlock (discovery↔chat 공존 — mock 대화 1턴) ────────────────
// 사용자 버블(우측 정렬 pill) → 에이전트 응답 한 줄 → CurationRow 와 동일한
// 가로 스크롤 상품 행. 실제 대화가 아니라 큐레이션 아래 append 되는 mock
// 블록이라 섹션 헤더/더보기는 없다.
function ConversationBlock({
  query,
  products,
  pinnedIds,
  onPressProduct,
  onTogglePin,
}: {
  query: string;
  products: Product[];
  pinnedIds: Set<string>;
  onPressProduct: (product: Product) => void;
  onTogglePin: (id: string) => void;
}) {
  return (
    <View>
      <View style={styles.userBubbleRow}>
        <View style={styles.userBubble}>
          <Text style={styles.userBubbleText}>{query}</Text>
        </View>
      </View>
      <Text style={styles.agentReplyText}>{AGENT_REPLY_TEXT}</Text>

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

// 대화 인덱스로 catalog 를 회전시켜 매 턴마다 다른 4개를 결정적으로 뽑는다
// (진짜 추천 로직 없음 — mock).
function pickConversationProducts(catalog: Product[], conversationIndex: number): Product[] {
  const start = (conversationIndex * CONVERSATION_PRODUCT_COUNT) % catalog.length;
  return Array.from(
    { length: CONVERSATION_PRODUCT_COUNT },
    (_, i) => catalog[(start + i) % catalog.length],
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
  product: Product;
  pinned: boolean;
  onPress: () => void;
  onPin: () => void;
}) {
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
        <ProductCard product={product} pinned={pinned} onPress={onPress} onPin={onPin} />
      </Animated.View>
    </Pressable>
  );
}

// ── SuggestionChips ──────────────────────────────────────────────────────
// 0번 칩("공용 · 가격무관")은 필터 토글이라 mock 전송을 트리거하지 않고
// 기존처럼 selection 햅틱만 준다. 그 외 칩은 라벨을 쿼리로 mock 전송한다.
function SuggestionChips({ onSend }: { onSend: (query: string) => void }) {
  const chips = ['공용 · 가격무관', ...SUGGESTION_CHIPS.map((c) => c.label)];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      {chips.map((label, i) => {
        const isFilterChip = i === 0;
        return (
          <Pressable
            key={label}
            hitSlop={4}
            onPress={() => (isFilterChip ? Haptic.selection() : onSend(label))}
          >
            <GlassSurface
              {...Glass.chip}
              isInteractive
              style={[styles.suggestionChip, isFilterChip && styles.filterChip]}
            >
              <Text style={styles.suggestionChipText}>{label}</Text>
            </GlassSurface>
          </Pressable>
        );
      })}
    </ScrollView>
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

// discovery↔chat 공존 — mock 대화 관련 구조적 수치.
// 대화 시작점으로 스크롤할 때 상단 플로팅 필에 가리지 않도록 두는 여유.
const CONVERSATION_TOP_CLEARANCE = TOP_PILL_HEIGHT + Spacing.four;
// 점프 버튼(↓) 크기 — spec: ~44px 원형 글래스 버튼.
const JUMP_BUTTON_SIZE = 44;
// 점프 버튼을 컴포저 영역 위에 띄우는 위치 — COMPOSER_CLEARANCE 가 이미
// 컴포저 영역 높이의 근사치이므로 그 위에 Spacing.two 만큼 더 띄운다.
const JUMP_BUTTON_BOTTOM = COMPOSER_CLEARANCE + Spacing.two;
// 대화 시작점이 화면 높이의 이 비율 이상 위로 스크롤되면 점프 버튼을 노출.
const JUMP_BUTTON_VISIBILITY_RATIO = 0.5;

// [큐레이션] 복귀 필 노출 임계 — 큐레이션 구좌(0 ~ conversationY)의 95%
// 이상이 뷰포트 위로 지나갔을 때 등장. 그보다 큐레이션이 많이 보이면
// 자동으로 축소·소멸.
const CURATION_PILL_REVEAL_RATIO = 0.95;
// 대화 블록 하나당 노출할 상품 개수.
const CONVERSATION_PRODUCT_COUNT = 4;
// top-anchored 히어로 — 추가 여백. 상단 플로팅 필의 clearance는
// scrollContent의 paddingTop(insets.top + TOP_PILL_HEIGHT + Spacing.two)
// 에서 이미 보장되므로, 이 비율은 그 아래 추가 spacing만 담당한다.
// paddingTop(HERO_TOP_ANCHOR_RATIO) + 콘텐츠 + paddingBottom(Spacing.five)
// 합쳐서 계산했을 때 좌측 정렬된 그리드 시작점을 결정한다.
const HERO_TOP_ANCHOR_RATIO = 0.015;
// 스크롤 연동 축소 애니메이션의 입력 범위(px)/출력 범위 — spec 값 그대로.
const HERO_SCROLL_RANGE = 120;
const HERO_MIN_OPACITY = 0.3;
const HERO_MIN_SCALE = 0.96;

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

  // Hero3 (타이틀 온리, top-anchored)
  // paddingTop 은 windowHeight 기반으로 JSX 쪽 인라인 스타일에서 준다
  // (HERO_TOP_ANCHOR_RATIO). paddingHorizontal 은 일부러 주지 않는다 —
  // scrollContent 의 Spacing.three 인셋을 그대로 물려받아야 타이틀이
  // CurationRow 섹션 타이틀과 같은 기준선을 공유한다.
  hero3: {
    paddingBottom: Spacing.five,
  },
  heroTitleManifesto: {
    ...IOSText.title1,
    // title1 기반 튜닝 — 히어로 선언용. 아이폰 14 기준 과대·과볼드 피드백
    // 반영 — semibold로 완화. 행간 넉넉하게 (따박따박 붙는 느낌 제거)
    fontSize: 27,
    lineHeight: 38,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    textAlign: 'left',
  },

  sectionTitle: {
    ...IOSText.title3,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
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
    justifyContent: 'space-between',
  },
  rowMoreText: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
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

  // ConversationBlock (discovery↔chat 공존 — mock 대화)
  conversationContainer: {
    gap: Spacing.five,
  },
  userBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '80%',
    backgroundColor: IOSColors.tertiarySystemFill,
    borderRadius: RadiusRole.chip,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  userBubbleText: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  agentReplyText: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.three,
    marginBottom: Spacing.three,
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
  chipsRow: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    paddingRight: Spacing.three,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: RadiusRole.chip,
    overflow: 'hidden',
  },
  filterChip: {
    // 첫 칩(필터)만 살짝 강조 — 배경은 시스템 필 토큰으로.
    backgroundColor: IOSColors.tertiarySystemFill,
  },
  suggestionChipText: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
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
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 대화 시작점으로 돌아가는 점프 버튼
  jumpButton: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  jumpButtonGlass: {
    width: JUMP_BUTTON_SIZE,
    height: JUMP_BUTTON_SIZE,
    borderRadius: RadiusRole.chip,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
