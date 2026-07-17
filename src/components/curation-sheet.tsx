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
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ProductCard } from '@/components/product-card';
import { MOCK_PRODUCTS, type Product } from '@/state/products';
import { Haptic, IOSColors, IOSFont, IOSText, Motion } from '@/theme';
import type { CurationSection } from '@/types/api';

// 구 Spacing 토큰 값 — labs 와 동일한 로컬 유지 (재도입 여부:
// docs/design-system-migration.md §3.2 논의 대상).
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32 } as const;

// curation-lab 과 동일한 mock 확장 — 12개 MOCK_PRODUCTS 로 4구좌(5·4·5·4)를
// 채우기 위한 복제. 실데이터 연동 시 이 파일에서 mock 전체가 사라진다.
const EXTRA_BRANDS = [
  { brand: 'mmlg', name: '와이드 팬츠', priceWon: 58000, colorHint: '#C7B7A3' },
  { brand: 'thisisneverthat', name: '헤비 후디', priceWon: 89000, colorHint: '#A9A9AE' },
  { brand: 'partimento', name: '니트 베스트', priceWon: 66000, colorHint: '#D8CBBB' },
  { brand: 'salt&paper', name: '스트라이프 셔츠', priceWon: 54000, colorHint: '#B9C4C9' },
  { brand: 'ader error', name: '그래픽 맨투맨', priceWon: 98000, colorHint: '#CBB8C2' },
  { brand: 'hidden nyc', name: '카고 팬츠', priceWon: 112000, colorHint: '#9B9C95' },
];

const SECTION_DEFS = [
  { title: '지금 인기 브랜드', subtitle: '키코에서 가장 사랑받는 브랜드' },
  { title: '요즘 많이 찾는 브랜드', subtitle: '검색량이 빠르게 오르는 중' },
  { title: 'Under $100', subtitle: '10만원 아래, 안목은 그대로' },
  { title: '지금 뜨는 베트남 핫걸 ST', subtitle: '사이공 트렌드세터의 여름 무드' },
];

const SECTION_CHUNKS = [5, 4, 5, 4];

function buildMockCatalog(): Product[] {
  const extras: Product[] = EXTRA_BRANDS.map((item, i) => ({
    id: `curation-${i + 1}`,
    brand: item.brand,
    name: item.name,
    priceWon: item.priceWon,
    colorHint: item.colorHint,
  }));
  return [...MOCK_PRODUCTS, ...extras];
}

// 화면 렌더 단위 — 서버/mock 양쪽 구좌를 같은 형태로 정규화.
type ViewSection = {
  key: string;
  title: string;
  subtitle: string | null;
  products: Product[];
};

// 서버 CurationProduct → 카드 Product. price 는 원화 float → 정수 절사.
// colorHint 는 이미지 로드 전 플레이스홀더 배경 (imageUri 가 있으면 미노출).
function toProducts(section: CurationSection): Product[] {
  return section.products.map((p) => ({
    id: String(p.product_id),
    brand: p.brand,
    name: p.name,
    priceWon: p.price != null ? Math.round(p.price) : 0,
    colorHint: IOSColors.systemGray5,
    imageUri: p.image_url,
  }));
}

function PressScaleCard({
  product,
  position,
  pinned,
  saved,
  onPress,
  onPin,
  onSave,
}: {
  product: Product;
  position: number;
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
          source="curation"
        />
      </Animated.View>
    </Pressable>
  );
}

// 구좌당 가로로 보여줄 카드 수 — 그 이상은 '더보기'로 전용 그리드 페이지에서.
const ROW_LIMIT = 5;

export function CurationSheet({
  sections: serverSections,
  pinnedProductId,
  onPressProduct,
  onPinProduct,
  onSaveProduct,
  onSeeMore,
  isSaved,
}: {
  /** GET /v1/curation 응답 구좌 (useCuration) — null 이면 mock 폴백. */
  sections?: CurationSection[] | null;
  /** 현재 컴포저에 핀된 상품 id (핀 체크마크 표시용). */
  pinnedProductId?: string | null;
  /** 상품 탭 — 로그인 시 PDP, 비로그인 시 로그인 시트 (home 이 분기). */
  onPressProduct: (product: Product) => void;
  /** + 핀 — 컴포저 위 상품 표시 토글 (home 상태). */
  onPinProduct: (product: Product) => void;
  /** 찜 토글 — 로그인 시 위시리스트, 비로그인 시 로그인 시트 (home 이 분기). */
  onSaveProduct: (product: Product) => void;
  /** 더보기 — 구좌 전용 그리드 페이지로 이동 (home 이 gender/route 처리). */
  onSeeMore?: (section: { key: string; title: string }) => void;
  /** 찜 여부 조회 (위시리스트). */
  isSaved: (productId: string) => boolean;
}) {
  const sections = useMemo<ViewSection[]>(() => {
    if (serverSections && serverSections.length > 0) {
      return serverSections
        .map((s) => ({
          key: s.id,
          title: s.title,
          subtitle: s.subtitle,
          products: toProducts(s),
        }))
        .filter((s) => s.products.length > 0);
    }
    // 폴백 — 응답·캐시 도착 전 or 실패. 실데이터가 오면 즉시 교체된다.
    const catalog = buildMockCatalog();
    let startIdx = 0;
    return SECTION_DEFS.map((def, i) => {
      const products = catalog.slice(startIdx, startIdx + SECTION_CHUNKS[i]);
      startIdx += SECTION_CHUNKS[i];
      return { key: `mock-${i}`, title: def.title, subtitle: def.subtitle, products };
    }).filter((s) => s.products.length > 0);
  }, [serverSections]);

  return (
    <View>
      {sections.map((section) => {
        // 가로엔 5개만. 그 이상 있으면 '더보기'로 전용 그리드 페이지 유도.
        const hasMore = section.products.length > ROW_LIMIT;
        const visible = section.products.slice(0, ROW_LIMIT);
        const goMore = () => {
          Haptic.light();
          onSeeMore?.({ key: section.key, title: section.title });
        };
        return (
        <View key={section.key} style={styles.rowSection}>
          <View style={styles.rowHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {hasMore && (
              <Pressable hitSlop={6} onPress={goMore}>
                <Text style={styles.rowMoreText}>더보기</Text>
              </Pressable>
            )}
          </View>
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
                pinned={pinnedProductId === product.id}
                saved={isSaved(product.id)}
                onPress={() => onPressProduct(product)}
                onPin={() => onPinProduct(product)}
                onSave={() => onSaveProduct(product)}
              />
            ))}
          </ScrollView>
        </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
