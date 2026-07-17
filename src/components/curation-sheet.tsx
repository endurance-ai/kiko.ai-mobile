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
import { type Product } from '@/state/products';
import { Haptic, IOSColors, IOSFont, IOSText, Motion } from '@/theme';
import type { CurationSection } from '@/types/api';

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
// 그리드 페이지는 이 개수만큼 건너뛰고 나머지를 보여주므로 공유(export).
export const CURATION_ROW_LIMIT = 10;

export function CurationSheet({
  sections: serverSections,
  loading,
  pinnedProductId,
  onPressProduct,
  onPinProduct,
  onSaveProduct,
  onSeeMore,
  isSaved,
}: {
  /** GET /v1/curation 응답 구좌 (useCuration) — 없으면 로딩/빈 상태. */
  sections?: CurationSection[] | null;
  /** 첫 로딩(캐시·서버 미도착) — mock 대신 스켈레톤을 보여준다. */
  loading?: boolean;
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
    if (!serverSections || serverSections.length === 0) return [];
    return serverSections
      .map((s) => ({
        key: s.id,
        title: s.title,
        subtitle: s.subtitle,
        products: toProducts(s),
      }))
      .filter((s) => s.products.length > 0);
  }, [serverSections]);

  // 실데이터 없고 아직 로딩 중이면 mock 대신 스켈레톤(데모 깜빡임 방지).
  if (sections.length === 0) {
    return loading ? <CurationSkeleton /> : null;
  }

  return (
    <View>
      {sections.map((section) => {
        // 가로엔 5개만. 그 이상 있으면 '더보기'로 전용 그리드 페이지 유도.
        const hasMore = section.products.length > CURATION_ROW_LIMIT;
        const visible = section.products.slice(0, CURATION_ROW_LIMIT);
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
