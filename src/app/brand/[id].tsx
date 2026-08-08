/**
 * 브랜드 홈 — 팔로우 앵커 화면 (brand-lab 시안의 실서비스판).
 *
 * GET /v1/brands/{id} (정보 + following/notify_enabled) + GET .../products (그리드).
 * 팔로우/알림: POST /v1/brands/{id}/follow {notify} 로 통합(언팔=DELETE). 비로그인은
 * 팔로우 탭 시 로그인 시트로 유도.
 */
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { ProductCard } from '@/components/product-card';
import {
  followBrand,
  getBrandHome,
  getBrandProducts,
  unfollowBrand,
} from '@/lib/brands';
import { useAuth } from '@/state/auth';
import { type Product } from '@/state/products';
import { Haptic, IOSColors, IOSFont, IOSText, Opacity, Radius } from '@/theme';
import type { BrandHome, BrandProduct } from '@/types/api';

const PAGE_SIZE = 20;

function toCardProduct(p: BrandProduct): Product {
  return {
    id: String(p.id),
    brand: p.brand,
    name: p.name,
    priceWon: Math.round(p.sale_price ?? p.price ?? 0),
    colorHint: IOSColors.systemGray5,
    imageUri: p.image_url,
  };
}

export default function BrandHomeScreen() {
  const insets = useSafeAreaInsets();
  const { id, brand_name } = useLocalSearchParams<{ id: string; brand_name?: string }>();
  const { status: authStatus } = useAuth();

  const [brand, setBrand] = useState<BrandHome | null>(null);
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [following, setFollowing] = useState(false);
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const toggleFollow = async () => {
    if (!id || busy || !requireAuth()) return;
    Haptic.medium();
    setBusy(true);
    const next = !following;
    setFollowing(next); // 낙관적
    setNotify(next);
    try {
      if (next) await followBrand(id, true);
      else await unfollowBrand(id);
    } catch {
      setFollowing(!next); // 롤백
      setNotify(!next);
      Haptic.error();
    } finally {
      setBusy(false);
    }
  };

  const toggleNotify = async () => {
    if (!id || busy || !following || !requireAuth()) return;
    Haptic.light();
    const next = !notify;
    setNotify(next);
    try {
      await followBrand(id, next); // POST 재호출로 notify 갱신(팔로우 유지)
    } catch {
      setNotify(!next);
      Haptic.error();
    }
  };

  const headerTitle = brand?.name ?? brand_name ?? '브랜드';

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

      <View style={styles.followRow}>
        <Pressable
          onPress={toggleFollow}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={following ? '팔로잉' : '팔로우'}
          style={({ pressed }) => [
            styles.followPill,
            following && styles.followPillOn,
            pressed && styles.pressedDim,
          ]}
        >
          <Text style={[styles.followText, following && styles.followTextOn]}>
            {following ? '팔로잉' : '팔로우'}
          </Text>
        </Pressable>
        {following && (
          <Pressable
            onPress={toggleNotify}
            accessibilityRole="button"
            accessibilityLabel={notify ? '알림 켜짐' : '알림 꺼짐'}
            style={({ pressed }) => [styles.bellBtn, pressed && styles.pressedDim]}
          >
            <SymbolView
              name={notify ? 'bell.fill' : 'bell'}
              size={18}
              tintColor={notify ? IOSColors.label : IOSColors.secondaryLabel}
              weight="medium"
            />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={products}
        keyExtractor={(p) => String(p.id)}
        numColumns={2}
        columnWrapperStyle={styles.column}
        renderItem={({ item }) => (
          <ProductCard
            product={toCardProduct(item)}
            source="brand"
            onPress={() => router.push(`/product/${item.id}` as never)}
            priceBelow
          />
        )}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{
          paddingTop: insets.top + FLOATING_HEADER_OFFSET,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 16,
        }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ paddingVertical: 24 }} /> : null
        }
      />
      <FloatingHeader title={headerTitle} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  info: {
    paddingVertical: 12,
    gap: 6,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 4,
  },
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
  },
  count: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  followPill: {
    paddingHorizontal: 24,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followPillOn: {
    backgroundColor: IOSColors.systemGray5,
  },
  followText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
  followTextOn: {
    color: IOSColors.label,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemGray5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressedDim: {
    opacity: Opacity.softened,
  },
  column: {
    gap: 12,
    marginBottom: 12,
  },
});
