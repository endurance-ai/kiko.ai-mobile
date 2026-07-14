/**
 * 큐레이션 시트 — 홈 빈 상태(첫 턴 이전)에 노출되는 발견형 진입 구좌.
 * curation-lab.tsx(3안 시안)의 CurationRow 를 실화면용으로 이식한 것.
 *
 * 데이터는 아직 mock (실데이터는 GET /v1/curation 연동 시 교체 — 구좌 4종:
 * 인기/검색량/가격대/자유 큐레이션, 취향 데이터 0 가정 7/13 확정).
 * ProductCard 의 impression 트래킹에 source="curation" 을 태워 취향 신호
 * 로깅(클릭·노출)의 씨앗을 심는다 — 나중 취향 큐레이션 전환의 재료.
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { ProductCard } from '@/components/product-card';
import { MOCK_PRODUCTS, type Product } from '@/state/products';
import { Haptic, IOSColors, IOSFont, IOSText, Motion } from '@/theme';

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

function PressScaleCard({
  product,
  position,
  pinned,
  onPin,
}: {
  product: Product;
  position: number;
  pinned: boolean;
  onPin: () => void;
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
          onPress={() => router.push(`/product/${product.id}`)}
          onPin={onPin}
          position={position}
          source="curation"
        />
      </Animated.View>
    </Pressable>
  );
}

export function CurationSheet() {
  const catalog = useMemo(() => buildMockCatalog(), []);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  const sections = useMemo(() => {
    let startIdx = 0;
    return SECTION_DEFS.map((def, i) => {
      const products = catalog.slice(startIdx, startIdx + SECTION_CHUNKS[i]);
      startIdx += SECTION_CHUNKS[i];
      return { ...def, products };
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

  return (
    <View>
      {sections.map((section) => (
        <View key={section.title} style={styles.rowSection}>
          <View style={styles.rowHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Pressable hitSlop={6} onPress={() => Haptic.light()}>
              <Text style={styles.rowMoreText}>더보기</Text>
            </Pressable>
          </View>
          <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rowScroll}
            contentContainerStyle={styles.rowScrollContent}
          >
            {section.products.map((product, i) => (
              <PressScaleCard
                key={product.id}
                product={product}
                position={i}
                pinned={pinnedIds.has(product.id)}
                onPin={() => togglePin(product.id)}
              />
            ))}
          </ScrollView>
        </View>
      ))}
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
