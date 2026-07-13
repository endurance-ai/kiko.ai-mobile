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
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { PRODUCT_CARD_WIDTH, ProductCard } from '@/components/product-card';
import {
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

const SECTION_DEFS = [
  { title: '지금 뜨는 인디 브랜드', subtitle: '이번 주 가장 많이 저장된 브랜드부터' },
  { title: '이번 주 화제의 무드', subtitle: '지금 취향 데이터에서 뜨는 무드 조합' },
  { title: '무신사엔 없는 발견', subtitle: '큰 플랫폼엔 안 뜨는 인디 · 빈티지 브랜드' },
];

const SUGGESTION_CHIPS = [
  '버건디 가디건',
  '하객룩 원피스',
  'Y2K 데님',
  '미니멀 오피스룩',
  '빈티지 레더 자켓',
];

const GREETING = '머릿속 그 옷,\n마법처럼 찾아드릴게요';

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

  // 6개씩 3섹션으로 분배 (마지막 섹션은 나머지 전부, 4~6개 범위 보장)
  const sections = useMemo(() => {
    const chunk = 6;
    return SECTION_DEFS.map((def, i) => ({
      ...def,
      products: catalog.slice(i * chunk, i * chunk + chunk),
    })).filter((s) => s.products.length > 0);
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

  return (
    <View style={styles.root}>
      <Animated.ScrollView
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

      {/* 하단 플로팅 컴포저 */}
      <View style={[styles.composerArea, { paddingBottom: insets.bottom + Spacing.one }]}>
        <SuggestionChips />
        <ComposerMock />
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
        {GREETING}
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
function SuggestionChips() {
  const chips = ['공용 · 가격무관', ...SUGGESTION_CHIPS];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chipsRow}
    >
      {chips.map((label, i) => (
        <Pressable key={label} hitSlop={4} onPress={() => Haptic.selection()}>
          <GlassSurface
            {...Glass.chip}
            isInteractive
            style={[styles.suggestionChip, i === 0 && styles.filterChip]}
          >
            <Text style={styles.suggestionChipText}>{label}</Text>
          </GlassSurface>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ── ComposerMock ─────────────────────────────────────────────────────────
function ComposerMock() {
  return (
    <GlassSurface {...Glass.composer} style={styles.composer}>
      <Text style={styles.composerPlaceholder} numberOfLines={1}>
        이미지/링크를 추가하거나 요청...
      </Text>
      <Pressable hitSlop={6} onPress={() => Haptic.medium()} style={styles.sendBtn}>
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
});
