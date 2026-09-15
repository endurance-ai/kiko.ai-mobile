/**
 * 편집샵 화면 — 홈 '편집샵 모아보기' 배너에서 진입. 브랜드 홈 상품 리스트 UI를
 * 재사용한 3열 그리드. 상단: 이름/설명 + 성별 탭 + 카테고리 필터, 하단: 상품
 * 목록(cursor 페이지네이션). 성별은 온보딩값 초기, 사용자가 변경 가능 —
 * 선택 성별 + unisex 병합은 서버가 처리(GET /v1/edit-shops/{platform}/…).
 */
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import {
  EDIT_SHOP_ALL_CATEGORY,
  getEditShopFilters,
  getEditShopProducts,
} from '@/lib/edit-shops';
import { readOnboardingGender } from '@/state/onboarding';
import { Haptic, IOSColors, IOSFont, IOSText, Radius } from '@/theme';
import type { EditShopFiltersResponse, EditShopProduct } from '@/types/api';

const PAGE_SIZE = 21; // 3 배수
const Spacing = { one: 4, two: 8, three: 16, four: 24 } as const;
const won = (n: number): string => `₩${Math.round(n).toLocaleString('ko-KR')}`;

export default function EditShopScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { platform } = useLocalSearchParams<{ platform: string }>();
  const tileW = width / 3;

  const [gender, setGender] = useState<'women' | 'men'>('women');
  // 온보딩 성별을 초기값으로 한 번 반영한 뒤에야 조회 시작(기본 women 로 헛조회 방지).
  const [genderReady, setGenderReady] = useState(false);
  const [category, setCategory] = useState<string>(EDIT_SHOP_ALL_CATEGORY);
  const [filters, setFilters] = useState<EditShopFiltersResponse | null>(null);
  const [products, setProducts] = useState<EditShopProduct[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    void readOnboardingGender().then((g) => {
      if (g === 'men') setGender('men');
      setGenderReady(true);
    });
  }, []);

  // 성별 변경 시 filters 재조회 — 카테고리 목록/카운트가 성별 종속.
  useEffect(() => {
    if (!platform || !genderReady) return;
    let cancelled = false;
    void getEditShopFilters(platform, gender)
      .then((f) => {
        if (!cancelled) setFilters(f);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [platform, gender, genderReady]);

  // 성별/카테고리 변경 시 상품 리셋 재조회.
  useEffect(() => {
    if (!platform || !genderReady) return;
    let cancelled = false;
    setProducts([]);
    setCursor(null);
    void getEditShopProducts(platform, { gender, category, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setProducts(res.items);
        setCursor(res.next_cursor);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [platform, gender, category, genderReady]);

  const loadMore = useCallback(async () => {
    if (!platform || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getEditShopProducts(platform, {
        gender,
        category,
        cursor,
        limit: PAGE_SIZE,
      });
      setProducts((prev) => [...prev, ...res.items]);
      setCursor(res.next_cursor);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [platform, gender, category, cursor, loadingMore]);

  // 성별 바꾸면 카테고리는 '전체'로 리셋(성별마다 유효 카테고리가 다름).
  const changeGender = (g: 'women' | 'men') => {
    if (g === gender) return;
    Haptic.selection();
    setCategory(EDIT_SHOP_ALL_CATEGORY);
    setGender(g);
  };
  const changeCategory = (key: string) => {
    if (key === category) return;
    Haptic.selection();
    setCategory(key);
  };

  const headerTitle = filters?.shop.display_name ?? '편집샵';
  const genderTabs = filters?.genders ?? [
    { key: 'women' as const, count: 0 },
    { key: 'men' as const, count: 0 },
  ];

  const listHeader = (
    <View style={styles.info}>
      <Text style={styles.shopName}>{headerTitle}</Text>
      {filters?.shop.description ? (
        <Text style={styles.desc}>{filters.shop.description}</Text>
      ) : null}

      {/* 성별 탭 */}
      <View style={styles.genderRow}>
        {genderTabs.map((g) => {
          const on = gender === g.key;
          return (
            <Pressable
              key={g.key}
              onPress={() => changeGender(g.key)}
              style={[styles.genderTab, on && styles.genderTabOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.genderTabText, on && styles.genderTabTextOn]}>
                {g.key === 'women' ? '여성' : '남성'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 카테고리 필터 */}
      {filters?.categories && filters.categories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={styles.catContent}
        >
          {filters.categories.map((c) => {
            const on = category === c.key;
            return (
              <Pressable
                key={c.key}
                onPress={() => changeCategory(c.key)}
                style={[styles.catChip, on && styles.catChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.catChipText, on && styles.catChipTextOn]}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );

  const renderTile = ({ item }: { item: EditShopProduct }) => {
    const price = item.sale_price ?? item.price;
    const showOld = item.sale_price != null && item.original_price != null;
    return (
      <Pressable
        style={[styles.tile, { width: tileW }]}
        onPress={() => router.push(`/product/${item.id}` as never)}
        accessibilityRole="button"
      >
        <ExpoImage
          source={{ uri: item.image_url }}
          style={styles.tileThumb}
          contentFit="cover"
        />
        <View style={styles.tileMeta}>
          <Text style={styles.tileBrand} numberOfLines={1}>
            {item.brand}
          </Text>
          <Text style={styles.tileName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.tilePriceRow}>
            {showOld && price != null && item.original_price != null && (
              <Text style={styles.tilePct} numberOfLines={1}>
                {Math.round((1 - price / item.original_price) * 100)}%
              </Text>
            )}
            {price != null && (
              <Text style={styles.tilePrice} numberOfLines={1}>
                {won(price)}
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
          paddingBottom: insets.bottom + 32,
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
  info: { paddingHorizontal: Spacing.three, paddingVertical: 12 },
  shopName: {
    ...IOSText.title2,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  desc: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    lineHeight: 20,
    marginTop: 6,
  },
  // ── 성별 탭 (2-세그먼트 필) ──
  genderRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.four,
  },
  genderTab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  genderTabOn: { backgroundColor: IOSColors.label, borderColor: IOSColors.label },
  genderTabText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  genderTabTextOn: { color: IOSColors.systemBackground },
  // ── 카테고리 칩 ──
  catScroll: {
    marginTop: Spacing.three,
    marginHorizontal: -Spacing.three, // 엣지투엣지 스크롤
  },
  catContent: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  catChipOn: { backgroundColor: IOSColors.label, borderColor: IOSColors.label },
  catChipText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  catChipTextOn: { color: IOSColors.systemBackground },
  // ── 상품 3열 그리드 (브랜드 홈 tile 문법 재사용) ──
  tile: { marginBottom: Spacing.three },
  tileThumb: {
    width: '100%',
    aspectRatio: 0.82,
    backgroundColor: IOSColors.tertiarySystemBackground,
    marginBottom: Spacing.two,
  },
  tileMeta: { paddingHorizontal: Spacing.one },
  tileBrand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  tileName: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: 1,
  },
  tilePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
    marginTop: 2,
  },
  tilePrice: {
    ...IOSText.footnote,
    fontWeight: '400',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  tilePct: {
    ...IOSText.footnote,
    fontWeight: '400',
    color: IOSColors.systemRed,
    fontFamily: IOSFont.sans,
  },
});
