/**
 * 편집샵 화면 — 홈 '편집샵 모아보기' 배너에서 진입. 브랜드 홈 상품 리스트 UI를
 * 재사용한 3열 그리드. 상단: 이름/설명 + 성별 탭 + 카테고리 필터, 하단: 상품
 * 목록(cursor 페이지네이션). 성별은 온보딩값 초기, 사용자가 변경 가능 —
 * 선택 성별 + unisex 병합은 서버가 처리(GET /v1/edit-shops/{platform}/…).
 */
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import * as WebBrowser from 'expo-web-browser';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { HeaderScrim } from '@/components/keyboard-scrim';
import { SearchComposer } from '@/components/search-composer';
import {
  EDIT_SHOP_ALL_CATEGORY,
  getEditShopFilters,
  getEditShopProducts,
} from '@/lib/edit-shops';
import { readOnboardingGender } from '@/state/onboarding';
import {
  Duration,
  Haptic,
  IOSColors,
  IOSFont,
  IOSText,
  Motion,
  Radius,
  Scrim,
  withAlpha,
} from '@/theme';
import type { EditShopFiltersResponse, EditShopProduct } from '@/types/api';

const PAGE_SIZE = 21; // 3 배수
const Spacing = { one: 4, two: 8, three: 16, four: 24 } as const;
const won = (n: number): string => `₩${Math.round(n).toLocaleString('ko-KR')}`;

// 카테고리 표시 순서(중요도) + 한글 라벨. 서버는 category(영문 L1)를 key 알파벳
// 순으로 주는데, 의류 핵심(상의·하의·아우터…)부터 오도록 재정렬하고 영문 key
// 를 한글로 보여준다. 목록에 없는 key 는 뒤로(기타 앞) 밀고 원문 라벨 유지.
const CATEGORY_META: Record<string, { label: string; rank: number }> = {
  tops: { label: '상의', rank: 1 },
  bottoms: { label: '하의', rank: 2 },
  outerwear: { label: '아우터', rank: 3 },
  knitwear: { label: '니트', rank: 4 },
  dresses: { label: '원피스', rank: 5 },
  shoes: { label: '신발', rank: 6 },
  bags: { label: '가방', rank: 7 },
  accessories: { label: '액세서리', rank: 8 },
  headwear: { label: '모자', rank: 9 },
  jewelry: { label: '주얼리', rank: 10 },
  eyewear: { label: '아이웨어', rank: 11 },
  activewear: { label: '액티브웨어', rank: 12 },
  swimwear: { label: '스윔웨어', rank: 13 },
  underwear: { label: '언더웨어', rank: 14 },
  other: { label: '기타', rank: 99 },
};
const CATEGORY_UNKNOWN_RANK = 50; // 알려지지 않은 key → 알려진 것 뒤, '기타' 앞

// 편집샵 공식 홈페이지 — 실제 상품 URL 도메인 기준. 서버 프로필에 store_url 이
// 없어 클라 상수로 둔다(플랫폼 5개 고정). TODO: 프로필에 store_url 추가되면 교체.
const PLATFORM_HOME: Record<string, string> = {
  slowsteadyclub: 'https://slowsteadyclub.com',
  '8division': 'https://www.8division.com',
  etcseoul: 'https://etcseoul.com',
  fr8ight: 'https://fr8ight.co.kr',
  kith: 'https://kith.com',
};

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
  const [descSheetVisible, setDescSheetVisible] = useState(false);

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
  // 프런트 임시 가드 — 남성에 새는 성별 부적합 카테고리 숨김(서버 태깅 수정 전까지).
  // 근본 원인은 서버 오태깅/성별 스코핑(원피스 누수 리포트 참조). 여기선 칩만 가림.
  const hiddenCategories =
    gender === 'men' ? new Set(['dresses']) : new Set<string>();
  // '전체'(all) 고정 첫번째, 나머지는 CATEGORY_META rank 순(미지정 key 는 뒤로).
  const orderedCategories = [...(filters?.categories ?? [])]
    .filter((c) => !hiddenCategories.has(c.key))
    .sort((a, b) => {
    const ra =
      a.key === EDIT_SHOP_ALL_CATEGORY
        ? -1
        : (CATEGORY_META[a.key]?.rank ?? CATEGORY_UNKNOWN_RANK);
    const rb =
      b.key === EDIT_SHOP_ALL_CATEGORY
        ? -1
        : (CATEGORY_META[b.key]?.rank ?? CATEGORY_UNKNOWN_RANK);
    return ra - rb;
  });

  const listHeader = (
    <View style={styles.info}>
      <Text style={styles.shopName}>{headerTitle}</Text>
      {filters?.shop.description ? (
        // 브랜드 페이지와 동일 — 말줄임(3줄), 탭하면 전체 설명 바텀시트.
        <Pressable
          onPress={() => {
            Haptic.light();
            setDescSheetVisible(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="편집샵 설명 전체 보기"
        >
          <Text style={styles.desc} numberOfLines={3}>
            {filters.shop.description}
          </Text>
        </Pressable>
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

      {/* 카테고리 필터 — '전체' 고정 첫번째 + 중요도 순 재정렬 + 한글 라벨. */}
      {orderedCategories.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={styles.catContent}
        >
          {orderedCategories.map((c) => {
            const on = category === c.key;
            const label = CATEGORY_META[c.key]?.label ?? c.label;
            return (
              <Pressable
                key={c.key}
                onPress={() => changeCategory(c.key)}
                style={[styles.catChip, on && styles.catChipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.catChipText, on && styles.catChipTextOn]}>
                  {label}
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
        // 편집샵 발(發) 전환 귀속 — PDP 의 product_view·outbound_click 이
        // source='edit_shop' + section_id=platform 을 실어, 편집샵별
        // 클릭→구매하러가기 플로우를 앰플리튜드에서 카운팅한다.
        onPress={() =>
          router.push(
            `/product/${item.id}?source=edit_shop&section_id=${encodeURIComponent(platform)}` as never,
          )
        }
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
          // 하단 고정 컴포저(약 insets+80)에 마지막 행이 가리지 않게 여유.
          paddingBottom: insets.bottom + 96,
        }}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ paddingVertical: 24 }} /> : null
        }
      />

      {/* 하단 검색 컴포저 — 제안 칩 없이 입력창만. 전송 시 새 채팅(home?chat=1)
          으로 seed 핸드오프 + platform 을 실어 편집샵 스코프 검색 유도(서버 필터
          랜딩 전엔 전체 검색으로 동작). 미포커싱 땐 컴포저 뒤 흰 페이드가 함께 뜬다. */}
      <SearchComposer
        placeholder={
          filters?.shop.display_name
            ? `${filters.shop.display_name}에서 검색`
            : '이 편집샵에서 검색'
        }
        scopeLabel={filters?.shop.display_name ?? '이 편집샵'}
        onSubmit={(t) =>
          router.push(
            `/home?chat=1&seed=${encodeURIComponent(t)}&platform=${encodeURIComponent(platform)}&platform_name=${encodeURIComponent(filters?.shop.display_name ?? '이 편집샵')}` as never,
          )
        }
      />

      {/* 설명 전문 시트 — ✕ + 전체 설명 + 공식 홈페이지 링크 (브랜드 페이지 문법). */}
      <AnimatedSheet
        visible={descSheetVisible}
        onClose={() => setDescSheetVisible(false)}
        cardStyle={styles.descSheetCard}
      >
        <Pressable
          hitSlop={8}
          onPress={() => setDescSheetVisible(false)}
          style={styles.sheetCloseBtn}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <SymbolView
            name="xmark"
            size={14}
            tintColor={IOSColors.secondaryLabel}
            weight="semibold"
          />
        </Pressable>
        <Text style={styles.descSheetTitle}>{headerTitle}</Text>
        {filters?.shop.description ? (
          <Text style={styles.descSheetBody}>{filters.shop.description}</Text>
        ) : null}
        {PLATFORM_HOME[platform] ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              Haptic.light();
              void WebBrowser.openBrowserAsync(PLATFORM_HOME[platform], {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
              });
            }}
            style={styles.descSheetLink}
            accessibilityRole="link"
            accessibilityLabel="공식 홈페이지 방문"
          >
            <Text style={styles.descSheetLinkText}>공식 홈페이지 방문</Text>
            <SymbolView
              name="arrow.up.right"
              size={13}
              tintColor={IOSColors.systemBlue}
              weight="semibold"
            />
          </Pressable>
        ) : null}
      </AnimatedSheet>

      {/* 헤더 상단 흰 페이드 — 스크롤 콘텐츠가 헤더 밑으로 지나가도 타이틀/
          아이콘이 읽히게. FloatingHeader(z50) 뒤(z45). */}
      <HeaderScrim height={insets.top + FLOATING_HEADER_OFFSET + 40} />
      <FloatingHeader title={headerTitle} />
    </View>
  );
}

/**
 * 바텀시트 프리미티브 — 스크림 페이드 + 카드 슬라이드. 브랜드 홈의 것과 동일
 * (release 급해 공유 추출 대신 복사 — 추후 shared 컴포넌트로 통합 여지).
 */
function AnimatedSheet({
  visible,
  onClose,
  cardStyle,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  cardStyle?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  if (!mounted) return null;
  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.sheetScrim}>
        {visible ? (
          <>
            <Animated.View
              entering={FadeIn.duration(Duration.base)}
              exiting={FadeOut.duration(Duration.base)}
              style={styles.sheetBackdrop}
            >
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={onClose}
                accessibilityLabel="닫기"
              />
            </Animated.View>
            <Animated.View
              entering={SlideInDown.springify()
                .dampingRatio(Motion.drawer.dampingRatio ?? 0.8)
                .duration(Motion.drawer.duration ?? 300)}
              exiting={SlideOutDown.duration(Duration.base).withCallback(
                (finished) => {
                  'worklet';
                  if (finished) runOnJS(setMounted)(false);
                },
              )}
              style={[styles.sheetCard, cardStyle, { paddingBottom: insets.bottom + 24 }]}
            >
              {children}
            </Animated.View>
          </>
        ) : null}
      </View>
    </Modal>
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
    // 카테고리 칩과 동일 사이즈.
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  genderTabOn: { backgroundColor: IOSColors.label, borderColor: IOSColors.label },
  genderTabText: {
    // 카테고리 칩과 동일 — 볼드 없이 기본 굵기.
    ...IOSText.subhead,
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
  // ── 설명 바텀시트 (브랜드 페이지와 동일) ──
  sheetScrim: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: withAlpha('#000000', Scrim.heavy),
  },
  sheetCard: {
    backgroundColor: IOSColors.systemBackground,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    alignItems: 'stretch',
  },
  descSheetCard: { alignItems: 'stretch' },
  sheetCloseBtn: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemGray5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  descSheetTitle: {
    ...IOSText.title2,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginBottom: Spacing.three,
  },
  descSheetBody: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    lineHeight: 24,
  },
  descSheetLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.four,
    alignSelf: 'flex-start',
  },
  descSheetLinkText: {
    ...IOSText.body,
    fontWeight: '600',
    color: IOSColors.systemBlue,
    fontFamily: IOSFont.sans,
  },
});
