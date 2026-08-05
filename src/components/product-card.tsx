import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Haptic, IOSColors, IOSFont, IOSText, Radius , withAlpha , Opacity } from '@/theme';
import { trackProductImpression } from '@/lib/analytics';
import { formatPrice, type Product } from '@/state/products';

const CARD_WIDTH = 156;
const CARD_HEIGHT = 196;

type Props = {
  product: Product;
  pinned?: boolean;
  /** 찜(위시리스트) 상태. onSave 가 있을 때만 하트 버튼을 렌더한다. */
  saved?: boolean;
  onPress?: () => void;
  onPin?: () => void;
  /** 브랜드명 탭 → 브랜드 홈 (2026-08-04 신설). 미전달 시 기존과 동일하게 비인터랙티브. */
  onBrandPress?: () => void;
  /** 찜 토글. 넘기면 핀(+) 아래 하트 버튼이 함께 뜬다. 비로그인 게이트는
   *  호출부 책임 (로그인 시트 유도 등) — 카드는 콜백만 위임한다. */
  onSave?: () => void;
  /** 이 노출을 발생시킨 검색의 search_id. 검색 발 노출의 조인 키. */
  searchId?: string | null;
  /** 큐레이션 구좌 ID — 큐레이션 발 노출의 조인 키 (search_id 대체). */
  sectionId?: string | null;
  /** 리스트에서의 0-based 위치. */
  position?: number | null;
  /** 노출 경로. 기본 "search". 향후 큐레이션 등 확장. */
  source?: string;
  /** 할인 전 정가. 있으면 priceTag 안에 취소선 정가 + 현재가를 함께 그린다
   *  (SSENSE 문법: 동일 타이포, 정가만 취소선 — 2026-08-03 확정). v1.2
   *  큐레이션 구좌(세일 표기)용 신설, 2026-08-04. 미전달 시 기존과 동일. */
  oldPriceWon?: number;
  /** true 면 이미지 좌상단에 흰 알약 "NEW" 배지. v1.2 큐레이션 구좌(신상
   *  표기)용 신설, 2026-08-04. 미전달 시 기존과 동일. */
  isNew?: boolean;
  /** size — v1.2 큐레이션 정사각 카드(2.5개 노출)용. 지정 시 root 폭 = size,
   *  이미지 영역 = size × size 정사각. 미전달 시 기존 세로형(156×196) 유지
   *  (2026-08-04) — 실서비스 호출부 무영향. */
  size?: number;
};

export function ProductCard({
  product,
  pinned = false,
  saved = false,
  onPress,
  onPin,
  onBrandPress,
  onSave,
  searchId,
  sectionId,
  position,
  source,
  oldPriceWon,
  isNew = false,
  size,
}: Props) {
  useEffect(() => {
    trackProductImpression({
      productId: String(product.id),
      brand: product.brand,
      searchId,
      sectionId,
      position,
      source,
    });
  }, [product.id, product.brand, searchId, sectionId, position, source]);
  const handlePress = () => {
    Haptic.light();
    onPress?.();
  };
  const handlePin = () => {
    Haptic.selection();
    onPin?.();
  };
  const handleSave = () => {
    Haptic.selection();
    onSave?.();
  };

  return (
    <View style={[styles.root, size != null && { width: size }]}>
      {/* 로딩 중엔 colorHint 가 배경으로 보여 회색 빈칸 대신 자리를 채운다. */}
      <Pressable
        style={[
          styles.imageWrap,
          // size 지정 시 정사각 이미지(사이즈 체계 2번). 미지정이면 기존 세로형.
          size != null && { width: size, height: size },
          { backgroundColor: product.colorHint },
        ]}
        onPress={handlePress}
      >
        {product.imageUri ? (
          <Image
            source={{ uri: product.imageUri }}
            style={styles.image}
            contentFit="cover"
            // 스크롤 중 이미지가 늦게 뜨는 것 완화: 메모리+디스크 캐시로
            // 재노출 즉시 표시, 첫 디코드는 150ms 페이드로 팝을 부드럽게.
            // recyclingKey 로 가로 리스트에서 뷰 재사용 시 이전 이미지 잔상 방지.
            cachePolicy="memory-disk"
            transition={150}
            recyclingKey={String(product.id)}
          />
        ) : (
          <View style={[styles.image, { backgroundColor: product.colorHint }]} />
        )}

        {/* 액션 행 — top right. 찜(하트) 왼쪽, 핀(+) 오른쪽으로 가로 배치.
            흰 알약 위에 얹혀서 아이콘은 시스템 스킴과 무관하게 항상 딥그레이.
            찜 on 상태만 알약을 label(다크) 로 채우고 하트를 반전한다 —
            결과 카드(streamCardHeartBtnOn)와 동일한 on-state 문법. */}
        {(onSave || onPin) && (
          <View style={styles.actionRow}>
            {onSave && (
              <Pressable
                hitSlop={{ top: 8, bottom: 8, left: 8, right: onPin ? 3 : 8 }}
                style={[styles.pinBtn, saved && styles.saveBtnOn]}
                onPress={handleSave}
              >
                <SymbolView
                  name={saved ? 'heart.fill' : 'heart'}
                  size={13}
                  tintColor={saved ? IOSColors.systemBackground : '#1C1C1E'}
                  weight="bold"
                />
              </Pressable>
            )}
            {/* 핀(+) — 컴포저 앵커. onPin 이 있을 때만(컴포저 없는 화면엔 미노출).
                hitSlop 은 간격 쪽만 3 으로 좁혀 하트와 히트영역 겹침 방지. */}
            {onPin && (
              <Pressable
                hitSlop={onSave ? { top: 8, bottom: 8, left: 3, right: 8 } : 8}
                style={styles.pinBtn}
                onPress={handlePin}
              >
                <SymbolView
                  name={pinned ? 'checkmark' : 'plus'}
                  size={14}
                  tintColor="#1C1C1E"
                  weight="bold"
                />
              </Pressable>
            )}
          </View>
        )}

        {/* NEW 배지 — top left. isNew 전달 시에만(v1.2 큐레이션 신상 구좌). */}
        {isNew && (
          <View style={styles.newTag}>
            <Text style={styles.newTagText}>NEW</Text>
          </View>
        )}

        {/* Price tag — bottom left. 가격 있을 때만(스트림 결과 등 가격 없는 소스는 생략).
            oldPriceWon 이 있으면 취소선 정가 + 현재가를 함께 그린다(SSENSE 문법:
            동일 타이포, 정가만 취소선). 좁은 정사각 카드(size 지정)에선 한 줄
            조합이 카드 폭을 넘어 현재가가 잘리므로 2줄 스택(취소선 위 / 현재가
            아래)으로 전환하고 paddingHorizontal 을 축소한다 — 기본(세로형)
            카드는 기존 한 줄 그대로. */}
        {product.priceWon > 0 && size == null && (
          <View
            style={[styles.priceTag, size != null && oldPriceWon != null && styles.priceTagCompact]}
          >
            {oldPriceWon && size != null ? (
              <>
                <Text style={[styles.priceText, styles.oldPriceText]} numberOfLines={1}>
                  {formatPrice(oldPriceWon)}
                </Text>
                <Text style={styles.priceText} numberOfLines={1}>
                  {formatPrice(product.priceWon)}
                </Text>
              </>
            ) : oldPriceWon ? (
              <Text style={styles.priceText} numberOfLines={1}>
                <Text style={styles.oldPriceText}>{formatPrice(oldPriceWon)}</Text>
                {' '}
                {formatPrice(product.priceWon)}
              </Text>
            ) : (
              <Text style={styles.priceText}>{formatPrice(product.priceWon)}</Text>
            )}
          </View>
        )}
      </Pressable>

      {size != null ? (
        // SSENSE 문법(brand-lab.tsx tile 계열 이식, 2026-08-05) — 큐레이션
        // 정사각 카드는 상품명을 렌더하지 않고 브랜드 + 가격 행만 노출한다.
        <>
          {onBrandPress ? (
            <Pressable
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`${product.brand} 브랜드 홈`}
              onPress={onBrandPress}
            >
              <Text style={styles.ssenseBrand} numberOfLines={1}>
                {product.brand}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.ssenseBrand} numberOfLines={1}>
              {product.brand}
            </Text>
          )}
          <View style={styles.ssensePriceRow}>
            <Text style={styles.ssensePrice} numberOfLines={1}>
              {formatPrice(product.priceWon)}
            </Text>
            {oldPriceWon != null && (
              <Text style={styles.ssenseOldPrice} numberOfLines={1}>
                {formatPrice(oldPriceWon)}
              </Text>
            )}
          </View>
        </>
      ) : (
        <>
          {onBrandPress ? (
            <Pressable
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`${product.brand} 브랜드 홈`}
              onPress={onBrandPress}
            >
              <Text style={styles.brand} numberOfLines={1}>
                {product.brand}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.brand} numberOfLines={1}>
              {product.brand}
            </Text>
          )}
          <Text style={styles.name} numberOfLines={1}>
            {product.name}
          </Text>
        </>
      )}
    </View>
  );
}

export const PRODUCT_CARD_WIDTH = CARD_WIDTH;

const styles = StyleSheet.create({
  root: {
    width: CARD_WIDTH,
  },
  imageWrap: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  actionRow: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 6,
  },
  pinBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    backgroundColor: withAlpha('#FFFFFF', Opacity.nearFull),
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtnOn: {
    backgroundColor: IOSColors.label,
  },
  priceTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.md,
    backgroundColor: withAlpha('#FFFFFF', Opacity.nearFull),
  },
  // 좁은 정사각 카드 + 취소선 2가격 조합 전용 — 태그가 카드 폭을 넘지 않게
  // 여백만 축소하고 우측 클리어런스를 확보한다 (2026-08-04).
  priceTagCompact: {
    paddingHorizontal: 6,
    maxWidth: '92%',
  },
  priceText: {
    ...IOSText.footnote,
    fontWeight: '700',
    // Always dark — sits on a white tag pinned over the photo.
    color: '#1C1C1E',
    fontFamily: IOSFont.sans,
  },
  // 취소선 정가 세그먼트 — priceText 안에 nested Text 로 얹는다. 회색조는
  // 흰 태그 배경 위 근사색 하드코딩 관례(위 priceText 의 '#1C1C1E'와 동일 근거).
  oldPriceText: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
  },
  // NEW 배지 — priceTag 와 동일한 흰 알약 문법, 이미지 좌상단.
  newTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.md,
    backgroundColor: withAlpha('#FFFFFF', Opacity.nearFull),
  },
  newTagText: {
    ...IOSText.footnote,
    fontWeight: '700',
    color: '#1C1C1E',
    fontFamily: IOSFont.sans,
  },
  brand: {
    ...IOSText.subhead,
    fontWeight: '700',
    color: IOSColors.label,
    marginTop: 10,
    fontFamily: IOSFont.sans,
  },
  name: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.sans,
  },
  // SSENSE 문법 — brand-lab.tsx tileBrand/tilePriceRow/tilePrice/tileOriginalPrice
  // 이식(2026-08-05). 큐레이션 정사각 카드(size 지정) 전용, 세로형 카드는
  // 위 brand/name 을 그대로 쓴다.
  ssenseBrand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    marginTop: 8,
    fontFamily: IOSFont.sans,
  },
  ssensePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 2,
  },
  ssensePrice: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  ssenseOldPrice: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    textDecorationLine: 'line-through',
    fontFamily: IOSFont.sans,
  },
});
