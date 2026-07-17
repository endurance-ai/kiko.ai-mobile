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
  /** 찜 토글. 넘기면 핀(+) 아래 하트 버튼이 함께 뜬다. 비로그인 게이트는
   *  호출부 책임 (로그인 시트 유도 등) — 카드는 콜백만 위임한다. */
  onSave?: () => void;
  /** 이 노출을 발생시킨 검색의 search_id. 없으면 impression 미발사. */
  searchId?: string | null;
  /** 리스트에서의 0-based 위치. */
  position?: number | null;
  /** 노출 경로. 기본 "search". 향후 큐레이션 등 확장. */
  source?: string;
};

export function ProductCard({
  product,
  pinned = false,
  saved = false,
  onPress,
  onPin,
  onSave,
  searchId,
  position,
  source,
}: Props) {
  useEffect(() => {
    trackProductImpression({
      productId: String(product.id),
      brand: product.brand,
      searchId,
      position,
      source,
    });
  }, [product.id, product.brand, searchId, position, source]);
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
    <View style={styles.root}>
      {/* 로딩 중엔 colorHint 가 배경으로 보여 회색 빈칸 대신 자리를 채운다. */}
      <Pressable
        style={[styles.imageWrap, { backgroundColor: product.colorHint }]}
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

        {/* Price tag — bottom left. 가격 있을 때만(스트림 결과 등 가격 없는 소스는 생략). */}
        {product.priceWon > 0 && (
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{formatPrice(product.priceWon)}</Text>
          </View>
        )}
      </Pressable>

      <Text style={styles.brand} numberOfLines={1}>
        {product.brand}
      </Text>
      <Text style={styles.name} numberOfLines={1}>
        {product.name}
      </Text>
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
  priceText: {
    ...IOSText.footnote,
    fontWeight: '700',
    // Always dark — sits on a white tag pinned over the photo.
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
});
