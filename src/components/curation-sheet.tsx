/**
 * 큐레이션 시트 — 홈 빈 상태(첫 턴 이전)에 노출되는 발견형 진입 구좌.
 * curation-lab.tsx(3안 시안)의 CurationRow 를 실화면용으로 이식한 것.
 *
 * 데이터는 GET /v1/curation (home.tsx 의 useCuration 훅이 공급) — 구좌
 * 개수·순서·타이틀 전부 server-driven. sections 가 null(응답·캐시 전 or
 * 실패)일 때만 기존 mock 구좌로 폴백해 빈 화면을 막는다.
 * ProductCard 의 impression 트래킹에 source="curation" 을 태워 취향 신호
 * 로깅(클릭·노출)의 씨앗을 심는다 — 나중 취향 큐레이션 전환의 재료.
 */
import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Fragment, type ReactNode, useMemo, useRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ProductCard } from '@/components/product-card';
import { type Product } from '@/state/products';
import { Haptic, IOSColors, IOSFont, IOSText, Motion, withAlpha } from '@/theme';
import type { CurationSection } from '@/types/api';

// 트렌딩 배너 배경 템플릿(디자인 export, Kiko 워드마크 각인 포함). 서버가
// 섹션 배경을 안 주므로 클라가 index 로 순회 — 트렌딩 섹션 수와 무관하게 순환.
const TREND_TEMPLATES = [
  require('../../assets/curation-trending/glow.png'),
  require('../../assets/curation-trending/green.png'),
  require('../../assets/curation-trending/blue.png'),
] as const;

// 구 Spacing 토큰 값 — labs 와 동일한 로컬 유지 (재도입 여부:
// docs/design-system-migration.md §3.2 논의 대상).
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32 } as const;

// 로딩 스켈레톤 — 첫 로딩(캐시·서버 모두 미도착) 동안 mock 데모 대신
// 회색 플레이스홀더를 보여준다. 실데이터가 오면 교체.
const SKELETON_SECTIONS = 2;
const SKELETON_CARDS = 5;
const SKELETON_CARD_W = 156;
const SKELETON_CARD_H = 196;

function CurationSkeleton() {
  return (
    <View>
      {Array.from({ length: SKELETON_SECTIONS }).map((_, si) => (
        <View key={si} style={styles.rowSection}>
          <View style={styles.skelTitle} />
          <View style={styles.skelSubtitle} />
          <View style={styles.skelRow}>
            {Array.from({ length: SKELETON_CARDS }).map((__, ci) => (
              <View key={ci} style={styles.skelCard} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// 화면 렌더 단위 — 서버 구좌를 카드 형태로 정규화.
type ViewSection = {
  key: string;
  title: string;
  subtitle: string | null;
  trending: boolean;
  products: Product[];
};

// 서버 CurationProduct → 카드 Product. price 는 원화 float → 정수 절사.
// colorHint 는 이미지 로드 전 플레이스홀더 배경 (imageUri 가 있으면 미노출).
function toProducts(section: CurationSection): Product[] {
  return section.products.map((p) => {
    const effective = p.sale_price ?? p.price;
    const onSale = p.sale_price != null && p.original_price != null;
    return {
      id: String(p.product_id),
      brand: p.brand,
      name: p.name,
      priceWon: effective != null ? Math.round(effective) : 0,
      originalPriceWon: onSale ? Math.round(p.original_price as number) : undefined,
      colorHint: IOSColors.systemGray5,
      imageUri: p.image_url,
    };
  });
}

function PressScaleCard({
  product,
  position,
  sectionId,
  pinned,
  saved,
  onPress,
  onPin,
  onSave,
}: {
  product: Product;
  position: number;
  /** 구좌 ID — impression 조인 키로 ProductCard 에 전달. */
  sectionId: string;
  pinned: boolean;
  saved: boolean;
  onPress: () => void;
  onPin: () => void;
  onSave: () => void;
}) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  return (
    <Pressable
      unstable_pressDelay={0}
      onPressIn={() => {
        scale.value = withSpring(0.97, Motion.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, Motion.snappy);
      }}
    >
      <Animated.View style={scaleStyle}>
        <ProductCard
          product={product}
          pinned={pinned}
          saved={saved}
          onPress={onPress}
          onPin={onPin}
          onSave={onSave}
          position={position}
          sectionId={sectionId}
          source="curation"
          priceBelow
        />
      </Animated.View>
    </Pressable>
  );
}

// 트렌딩 배너 카드 크기 — 배경 템플릿(1080×1458, 3:4) 비율 유지. 옆 카드가
// 살짝 보이도록 화면폭보다 좁게 고정.
const TREND_CARD_W = 252;
const TREND_CARD_H = Math.round((TREND_CARD_W * 1458) / 1080); // ≈ 389

// 트렌딩 섹션 1개 = 큰 배너 카드 1장. 배경은 디자인 템플릿 이미지(Kiko 각인
// 포함)를 index 로 순회. 그 위에 서브타이틀+타이틀을 흰 글자로 얹고(하단 스크림
// 으로 가독 보장), 탭하면 해당 구좌 전용 그리드 페이지로(default '더보기'와 동일).
// 서브타이틀은 서버가 채우면 자동 표시(없으면 타이틀만).
function TrendingCard({
  section,
  index,
  onPress,
}: {
  section: ViewSection;
  index: number;
  onPress: () => void;
}) {
  const bg = TREND_TEMPLATES[index % TREND_TEMPLATES.length];

  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      unstable_pressDelay={0}
      onPressIn={() => {
        scale.value = withSpring(0.97, Motion.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, Motion.snappy);
      }}
      onPress={() => {
        Haptic.light();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${section.title} 트렌딩`}
    >
      <Animated.View style={[styles.trendCard, scaleStyle]}>
        <Image source={bg} style={StyleSheet.absoluteFill} contentFit="cover" />
        {/* 좌하단 서브타이틀 + 타이틀 (Kiko 워드마크는 배경 이미지에 각인됨). */}
        <View style={styles.trendTextWrap}>
          {section.subtitle != null && (
            <Text style={styles.trendSubtitle} numberOfLines={1}>
              {section.subtitle}
            </Text>
          )}
          <Text style={styles.trendTitle} numberOfLines={2}>
            {section.title}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// 트렌딩 레일 — 스와이프 세기(velocity)에 따라 한 번에 1칸 또는 최대 2칸만
// 넘어가는 커스텀 스냅. 네이티브 관성에 맡기면 강한 플릭에 여러 장이 훅 지나
// 가므로, 손을 뗀 시점의 속도/드래그량으로 목표 index 를 직접 계산해 scrollTo.
const TREND_SNAP_INTERVAL = TREND_CARD_W + Spacing.two; // 카드폭 + 카드 간 gap
const TREND_V_WEAK = 0.1; // 이 이하이고 드래그도 짧으면 제자리 복귀

function TrendingRail({
  sections,
  onOpen,
}: {
  sections: ViewSection[];
  onOpen: (section: ViewSection) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const dragStartX = useRef(0);
  const maxIndex = sections.length - 1;

  const handleBeginDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragStartX.current = e.nativeEvent.contentOffset.x;
  };

  const handleEndDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, velocity } = e.nativeEvent;
    const v = velocity?.x ?? 0;
    const dragged = contentOffset.x - dragStartX.current;
    const dir = v !== 0 ? Math.sign(v) : Math.sign(dragged);
    const startIndex = Math.round(dragStartX.current / TREND_SNAP_INTERVAL);

    const absV = Math.abs(v);
    const absDrag = Math.abs(dragged);
    // 압력(velocity)과 무관하게 한 번에 최대 1칸만 이동. 최소 임계 넘으면 1칸,
    // 아니면 제자리 복귀.
    const steps = absV > TREND_V_WEAK || absDrag >= TREND_SNAP_INTERVAL * 0.25 ? 1 : 0;

    const target = Math.max(0, Math.min(maxIndex, startIndex + dir * steps));
    scrollRef.current?.scrollTo({ x: target * TREND_SNAP_INTERVAL, animated: true });
  };

  return (
    <View style={styles.rowSection}>
      <View style={styles.rowHeader}>
        <Text style={styles.sectionTitle}>트렌딩</Text>
      </View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.rowScroll}
        contentContainerStyle={styles.rowScrollContent}
        // 커스텀 스냅: 네이티브 관성 멈춤을 빠르게 하고, 손 뗀 순간 목표로 scrollTo.
        decelerationRate="fast"
        scrollEventThrottle={16}
        onScrollBeginDrag={handleBeginDrag}
        onScrollEndDrag={handleEndDrag}
      >
        {sections.map((section, i) => (
          <TrendingCard
            key={section.key}
            section={section}
            index={i}
            onPress={() => onOpen(section)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// 구좌당 가로로 보여줄 카드 수 — 그 이상은 '더보기'로 전용 그리드 페이지에서.
// 그리드 페이지는 이 개수만큼 건너뛰고 나머지를 보여주므로 공유(export).
export const CURATION_ROW_LIMIT = 20;

export function CurationSheet({
  sections: serverSections,
  loading,
  pinnedProductId,
  onPressProduct,
  onPinProduct,
  onSaveProduct,
  onSeeMore,
  isSaved,
  insertBeforeTitle,
  insertBeforeSlot,
}: {
  /** GET /v1/curation 응답 구좌 (useCuration) — 없으면 로딩/빈 상태. */
  sections?: CurationSection[] | null;
  /** 첫 로딩(캐시·서버 미도착) — mock 대신 스켈레톤을 보여준다. */
  loading?: boolean;
  /** 현재 컴포저에 핀된 상품 id (핀 체크마크 표시용). */
  pinnedProductId?: string | null;
  /** 상품 탭 — 로그인 시 PDP, 비로그인 시 로그인 시트 (home 이 분기).
   * sectionKey = 구좌 ID — PDP·이벤트에 발화 문맥으로 전달 (기획 7/23). */
  onPressProduct: (product: Product, sectionKey: string) => void;
  /** + 핀 — 컴포저 위 상품 표시 토글 (home 상태). */
  onPinProduct: (product: Product, sectionKey: string) => void;
  /** 찜 토글 — 로그인 시 위시리스트, 비로그인 시 로그인 시트 (home 이 분기). */
  onSaveProduct: (product: Product, sectionKey: string) => void;
  /** 더보기 — 구좌 전용 그리드 페이지로 이동 (home 이 gender/route 처리). */
  onSeeMore?: (section: { key: string; title: string }) => void;
  /** 찜 여부 조회 (위시리스트). */
  isSaved: (productId: string) => boolean;
  /** 이 제목의 섹션 바로 위에 렌더할 노드 ('찾는 게 없나요?' 칩 블록). */
  insertBeforeTitle?: string;
  insertBeforeSlot?: ReactNode;
}) {
  const sections = useMemo<ViewSection[]>(() => {
    if (!serverSections || serverSections.length === 0) return [];
    return serverSections
      .map((s) => ({
        key: s.id,
        title: s.title,
        subtitle: s.subtitle,
        trending: s.display_type === 'trending',
        products: toProducts(s),
      }))
      .filter((s) => s.products.length > 0);
  }, [serverSections]);

  // 트렌딩은 서버 순서상 어디에 있든 상단 히어로 레일로 승격, 나머지는 기존
  // 가로 상품 행. 각 그룹 안에서는 서버 순서를 그대로 보존한다.
  const trendingSections = useMemo(() => sections.filter((s) => s.trending), [sections]);
  const defaultSections = useMemo(() => sections.filter((s) => !s.trending), [sections]);

  // 실데이터 없고 아직 로딩 중이면 mock 대신 스켈레톤(데모 깜빡임 방지).
  if (sections.length === 0) {
    return loading ? <CurationSkeleton /> : null;
  }

  return (
    <View>
      {trendingSections.length > 0 && (
        <TrendingRail
          sections={trendingSections}
          onOpen={(section) => onSeeMore?.({ key: section.key, title: section.title })}
        />
      )}
      {defaultSections.map((section) => {
        // 가로엔 5개만. 그 이상 있으면 '더보기'로 전용 그리드 페이지 유도.
        const hasMore = section.products.length > CURATION_ROW_LIMIT;
        const visible = section.products.slice(0, CURATION_ROW_LIMIT);
        const goMore = () => {
          Haptic.light();
          onSeeMore?.({ key: section.key, title: section.title });
        };
        return (
        <Fragment key={section.key}>
          {section.title === insertBeforeTitle && insertBeforeSlot}
          <View style={styles.rowSection}>
          {/* 더보기 = 타이틀 바로 오른쪽 › 셰브런(brand-lab '최근 소식 ›' 문법).
              타이틀+셰브런 전체가 탭 영역 → 전용 그리드 페이지로. */}
          {hasMore ? (
            <Pressable
              hitSlop={6}
              onPress={goMore}
              accessibilityRole="button"
              accessibilityLabel={`${section.title} 더보기`}
              style={styles.rowHeader}
            >
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {Platform.OS === 'web' ? (
                <Text style={styles.rowMoreChevron}>›</Text>
              ) : (
                <SymbolView
                  name="chevron.right"
                  size={17}
                  tintColor={IOSColors.secondaryLabel}
                  weight="semibold"
                />
              )}
            </Pressable>
          ) : (
            <View style={styles.rowHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          {section.subtitle != null && (
            <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
          )}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rowScroll}
            contentContainerStyle={styles.rowScrollContent}
          >
            {visible.map((product, i) => (
              <PressScaleCard
                key={product.id}
                product={product}
                position={i}
                sectionId={section.key}
                pinned={pinnedProductId === product.id}
                saved={isSaved(product.id)}
                onPress={() => onPressProduct(product, section.key)}
                onPin={() => onPinProduct(product, section.key)}
                onSave={() => onSaveProduct(product, section.key)}
              />
            ))}
          </ScrollView>
          </View>
        </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rowSection: {
    marginBottom: Spacing.five,
  },
  // 타이틀 + › 셰브런을 왼쪽에 붙여 배치(맨 오른쪽 '더보기' 대체). 콘텐츠
  // 폭으로 줄여 타이틀 바로 오른쪽에 셰브런이 오게 한다.
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
  // 웹 폴백 › — brand-lab '최근 소식 ›' 와 동일 문법(네이티브는 SF chevron).
  rowMoreChevron: {
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    transform: [{ translateY: -2 }],
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
  rowScroll: {
    marginTop: Spacing.three,
    // 부모 인셋 상쇄 — 카드가 헤더 텍스트와 같은 x 에서 시작하면서도
    // 화면 가장자리까지 스크롤되도록 (contentContainerStyle 에서 재인셋).
    marginHorizontal: -Spacing.three,
  },
  rowScrollContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },

  // ── 트렌딩 배너 카드 ──
  trendCard: {
    width: TREND_CARD_W,
    height: TREND_CARD_H,
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
    justifyContent: 'flex-end',
  },
  trendTextWrap: {
    gap: 3,
  },
  trendSubtitle: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: withAlpha('#FFFFFF', 0.9),
    fontFamily: IOSFont.sans,
  },
  trendTitle: {
    ...IOSText.title2,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: IOSFont.sans,
  },

  // ── 로딩 스켈레톤 ──
  skelTitle: {
    width: 140,
    height: 20,
    borderRadius: 6,
    backgroundColor: IOSColors.systemGray5,
  },
  skelSubtitle: {
    width: 96,
    height: 12,
    borderRadius: 5,
    backgroundColor: IOSColors.systemGray6,
    marginTop: Spacing.two,
  },
  skelRow: {
    flexDirection: 'row',
    marginTop: Spacing.three,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  skelCard: {
    width: SKELETON_CARD_W,
    height: SKELETON_CARD_H,
    borderRadius: 16,
    backgroundColor: IOSColors.systemGray6,
  },
});
