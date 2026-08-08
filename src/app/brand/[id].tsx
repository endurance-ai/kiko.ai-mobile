/**
 * 브랜드 홈 — 팔로우 앵커 화면 (강현규 brand-lab 시안의 실서비스판).
 *
 * GET /v1/brands/{id} (정보 + following/notify_enabled) + GET .../products(3열 그리드).
 * 하단 플로팅 CTA = [팔로우] 필 + 벨 원형. 인터랙션(2026-08-08 스펙):
 *  - 팔로우 탭 = 즉시 성립(notify=false) → 시트 "세일, 신상 소식도 알려드릴까요?"
 *    · [알림도 받기] → 권한 게이트 후 notify ON  · [팔로우만 할게요] → 알림 변화 없음
 *  - 벨 탭(미팔로우/미알림) = 팔로우 + 알림 자동 ON(권한 게이트). 알림 ON 상태 = 토글 OFF
 *  - 권한 거부(시스템 OFF) = iOS 설정으로 이동 안내
 * 팔로우/알림 = POST /v1/brands/{id}/follow {notify} 통합(언팔=DELETE). 비로그인 → 로그인 시트.
 */
import { Image as ExpoImage } from 'expo-image';
import * as Notifications from 'expo-notifications';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { followBrand, getBrandHome, getBrandProducts, unfollowBrand } from '@/lib/brands';
import { useAuth } from '@/state/auth';
import { Haptic, IOSColors, IOSFont, IOSText, Opacity, Radius, Scrim, withAlpha } from '@/theme';
import type { BrandHome, BrandProduct } from '@/types/api';

const PAGE_SIZE = 21; // 3 배수
const FOOTER_CONTROL = 56;
const CTA_HEIGHT = 50;

const won = (n: number): string => `₩${Math.round(n).toLocaleString('ko-KR')}`;

/** notify 켜기 전 iOS 알림 권한 확보. 거부면 설정 이동 안내 후 false. */
async function ensureNotifyPermission(): Promise<boolean> {
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (cur.status === 'undetermined' || cur.canAskAgain) {
    const next = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    return next.granted;
  }
  Alert.alert('알림 권한이 필요해요', 'iOS 설정에서 키코 앱의 알림을 켜 주세요.', [
    { text: '취소', style: 'cancel' },
    { text: '설정 열기', onPress: () => void Linking.openSettings() },
  ]);
  return false;
}

export default function BrandHomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { id, brand_name } = useLocalSearchParams<{ id: string; brand_name?: string }>();
  const { status: authStatus } = useAuth();

  const [brand, setBrand] = useState<BrandHome | null>(null);
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [following, setFollowing] = useState(false);
  const [notify, setNotify] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void getBrandHome(id)
      .then((b) => {
        if (cancelled) return;
        setBrand(b);
        setFollowing(b.following);
        setNotify(b.notify_enabled);
      })
      .catch(() => {});
    void getBrandProducts(id, { limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setProducts(res.items);
        setCursor(res.next_cursor);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadMore = useCallback(async () => {
    if (!id || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getBrandProducts(id, { cursor, limit: PAGE_SIZE });
      setProducts((prev) => [...prev, ...res.items]);
      setCursor(res.next_cursor);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [id, cursor, loadingMore]);

  const requireAuth = (): boolean => {
    if (authStatus === 'authenticated') return true;
    router.push('/login');
    return false;
  };

  /** 시트 [알림도 받기] & 벨 켜기 — 권한 게이트 후 팔로우+알림 성립. */
  const enableNotify = async () => {
    if (!id) return;
    const ok = await ensureNotifyPermission();
    setSheetVisible(false);
    if (!ok) return;
    setFollowing(true);
    setNotify(true);
    void followBrand(id, true).catch(() => setNotify(false));
  };

  const toggleFollow = () => {
    if (!id || !requireAuth()) return;
    Haptic.medium();
    if (following) {
      setFollowing(false);
      setNotify(false);
      void unfollowBrand(id).catch(() => setFollowing(true));
      return;
    }
    // 팔로우 즉시 성립(알림은 시트에서 결정). notify=false 로 등록.
    setFollowing(true);
    setNotify(false);
    void followBrand(id, false).catch(() => setFollowing(false));
    setSheetVisible(true);
  };

  const toggleBell = () => {
    if (!id || !requireAuth()) return;
    if (notify) {
      Haptic.selection();
      setNotify(false);
      void followBrand(id, false).catch(() => setNotify(true));
      return;
    }
    void enableNotify(); // 미알림 → 팔로우+알림 자동 ON(권한 게이트)
  };

  const headerTitle = brand?.name ?? brand_name ?? '브랜드';
  const tileW = windowWidth / 3;

  const listHeader = (
    <View style={styles.info}>
      {brand?.logo_url ? (
        <ExpoImage source={{ uri: brand.logo_url }} style={styles.logo} contentFit="contain" />
      ) : null}
      <Text style={styles.brandName}>{headerTitle}</Text>
      {brand?.description ? (
        <Text style={styles.description} numberOfLines={3}>
          {brand.description}
        </Text>
      ) : null}
      {brand != null && (
        <Text style={styles.count}>상품 {brand.product_count.toLocaleString('ko-KR')}개</Text>
      )}
      <Text style={styles.sectionHeader}>상품</Text>
    </View>
  );

  const renderTile = ({ item }: { item: BrandProduct }) => {
    const price = item.sale_price ?? item.price;
    const showOld = item.sale_price != null && item.original_price != null;
    return (
      <Pressable
        style={[styles.tile, { width: tileW }]}
        onPress={() => router.push(`/product/${item.id}` as never)}
        accessibilityRole="button"
      >
        <ExpoImage source={{ uri: item.image_url }} style={styles.tileThumb} contentFit="cover" />
        <View style={styles.tileMeta}>
          <Text style={styles.tileBrand} numberOfLines={1}>
            {item.brand}
          </Text>
          <View style={styles.tilePriceRow}>
            {price != null && (
              <Text style={styles.tilePrice} numberOfLines={1}>
                {won(price)}
              </Text>
            )}
            {showOld && (
              <Text style={styles.tileOriginalPrice} numberOfLines={1}>
                {won(item.original_price as number)}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        numColumns={3}
        renderItem={renderTile}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{
          paddingTop: insets.top + FLOATING_HEADER_OFFSET,
          paddingBottom: insets.bottom + FOOTER_CONTROL + 32,
        }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ paddingVertical: 24 }} /> : null
        }
      />

      {/* 하단 플로팅 CTA — [팔로우] 필 + 벨 원형 (애플뮤직 2버튼 문법). */}
      <View style={[styles.ctaFooter, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.followRow}>
          <Pressable
            style={({ pressed }) => [
              styles.followSlot,
              styles.followBtn,
              following ? styles.followBtnOn : styles.followBtnOff,
              pressed && styles.pressedDim,
            ]}
            onPress={toggleFollow}
            accessibilityRole="button"
            accessibilityState={{ selected: following }}
            accessibilityLabel={following ? '팔로잉, 해제하려면 탭' : '브랜드 팔로우'}
          >
            <Text style={following ? styles.followBtnTextOn : styles.followBtnTextOff}>
              {following ? '팔로잉 ✓' : '팔로우'}
            </Text>
          </Pressable>
          <Pressable
            onPress={toggleBell}
            accessibilityRole="button"
            accessibilityState={{ selected: notify }}
            accessibilityLabel={notify ? '브랜드 알림 끄기' : '브랜드 알림 켜기'}
            style={({ pressed }) => [styles.bellBtn, notify && styles.bellBtnOn, pressed && styles.pressedDim]}
          >
            <SymbolView
              name={notify ? 'bell.fill' : 'bell'}
              size={24}
              tintColor={notify ? IOSColors.systemBackground : IOSColors.label}
              weight="medium"
            />
          </Pressable>
        </View>
      </View>

      {/* 팔로우 직후 소식 제안 — [팔로우만 할게요]여도 팔로우는 유지 */}
      <Modal
        visible={sheetVisible}
        transparent
        statusBarTranslucent
        animationType="slide"
        onRequestClose={() => setSheetVisible(false)}
      >
        <View style={styles.sheetScrim}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSheetVisible(false)} accessibilityLabel="닫기" />
          <View style={[styles.sheetCard, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.sheetTitle}>{'세일, 신상 소식도\n알려드릴까요?'}</Text>
            <Pressable
              style={({ pressed }) => [styles.sheetPrimaryBtn, pressed && styles.pressedDim]}
              onPress={() => {
                Haptic.medium();
                void enableNotify();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.sheetPrimaryText}>알림도 받기</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.sheetSecondaryBtn, pressed && styles.pressedDim]}
              onPress={() => {
                Haptic.light();
                setSheetVisible(false);
              }}
              accessibilityRole="button"
            >
              <Text style={styles.sheetSecondaryText}>팔로우만 할게요</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <FloatingHeader title={headerTitle} />
    </View>
  );
}

const Spacing = { one: 4, two: 8, three: 16, four: 24 } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  info: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
  },
  logo: { width: 64, height: 64, marginBottom: 4 },
  brandName: {
    ...IOSText.title2,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  description: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    lineHeight: 20,
    marginTop: 6,
  },
  count: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: 6,
  },
  sectionHeader: {
    ...IOSText.title3,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.four,
  },
  // ── 상품 3열 엣지투엣지 그리드 (PDP 비슷한 제품 / brand-lab tile 문법) ──
  tile: {},
  tileThumb: {
    width: '100%',
    aspectRatio: 0.82,
    backgroundColor: IOSColors.tertiarySystemBackground,
    marginBottom: 2,
  },
  tileMeta: {
    paddingHorizontal: Spacing.one,
  },
  tileBrand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  tilePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  tilePrice: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  tileOriginalPrice: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    textDecorationLine: 'line-through',
  },
  // ── 하단 CTA ──
  ctaFooter: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: 0,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  followSlot: { flex: 1 },
  followBtn: {
    minHeight: FOOTER_CONTROL,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followBtnOff: { backgroundColor: IOSColors.label },
  followBtnOn: {
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  followBtnTextOff: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
  followBtnTextOn: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  bellBtn: {
    width: FOOTER_CONTROL,
    height: FOOTER_CONTROL,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    overflow: 'hidden',
  },
  bellBtnOn: {
    backgroundColor: IOSColors.label,
    borderColor: IOSColors.label,
  },
  pressedDim: { opacity: Opacity.softened },
  // ── 팔로우 소식 시트 ──
  sheetScrim: {
    flex: 1,
    backgroundColor: withAlpha('#000000', Scrim.heavy),
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: IOSColors.systemBackground,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.four,
    paddingTop: 32,
    alignItems: 'center',
  },
  sheetTitle: {
    ...IOSText.title3,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  sheetPrimaryBtn: {
    width: '100%',
    minHeight: CTA_HEIGHT,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
  sheetSecondaryBtn: {
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  sheetSecondaryText: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
});
