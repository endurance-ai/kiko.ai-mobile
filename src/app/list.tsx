import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { ApiError } from '@/lib/api';
import { getResultSetPage } from '@/lib/results';
import { useBanner } from '@/state/banner';
import { formatPrice } from '@/state/products';
import type { ResultProduct, ResultSetPageResponse } from '@/types/api';

// Edge-to-edge 3-col grid (mirrors PDP similar grid — no side padding, no
// column gap, tile width = SCREEN_W / 3, thumb aspect 0.82).
const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W / 3;
const PAGE_LIMIT = 60;

export default function ListScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ search?: string }>();
  const searchId = (params.search as string | undefined) || null;
  const { show: showBanner } = useBanner();

  const [page, setPage] = useState<ResultSetPageResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [errored, setErrored] = useState<boolean>(false);

  const load = useCallback(async () => {
    if (!searchId) return;
    setLoading(true);
    setErrored(false);
    try {
      const res = await getResultSetPage(searchId, { limit: PAGE_LIMIT });
      setPage(res);
    } catch (err) {
      setErrored(true);
      if (!(err instanceof ApiError && err.status === 404)) {
        showBanner({
          id: 'list-load-failed',
          priority: 'error',
          title: '리스트를 불러오지 못했어요',
          action: { label: '다시 시도', onPress: () => void load() },
        });
      }
    } finally {
      setLoading(false);
    }
  }, [searchId, showBanner]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!searchId || !page || !page.next_cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await getResultSetPage(searchId, {
        cursor: page.next_cursor,
        limit: PAGE_LIMIT,
      });
      setPage((prev) =>
        prev
          ? { ...next, items: [...prev.items, ...next.items] }
          : next,
      );
    } catch {
      // silent; the sentinel scroll will retry next time
    } finally {
      setLoadingMore(false);
    }
  }, [searchId, page, loadingMore]);

  const items = page?.items ?? [];
  const title = page?.title ?? '검색 결과';
  const count = page?.result_count ?? items.length;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          {
            paddingTop: insets.top + FLOATING_HEADER_OFFSET,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        onScrollEndDrag={loadMore}
        showsVerticalScrollIndicator={false}
      >
        {searchId && (
          <View style={styles.headerBlock}>
            <View style={styles.titleRow}>
              <View style={styles.dot} />
              <Text style={styles.title} numberOfLines={2}>
                {title}
              </Text>
            </View>
            <Text style={styles.countText}>{count}개</Text>
          </View>
        )}

        {!searchId && (
          <View style={styles.center}>
            <Text style={styles.muted}>표시할 리스트가 없어요</Text>
            <Text style={styles.mutedSmall}>홈에서 새 검색을 시작해보세요</Text>
          </View>
        )}

        {searchId && loading && items.length === 0 && (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        )}

        {searchId && !loading && items.length === 0 && errored && (
          <View style={styles.center}>
            <Text style={styles.muted}>리스트를 불러오지 못했어요</Text>
          </View>
        )}

        {items.length > 0 && (
          <View style={styles.grid}>
            {items.map((p) => (
              <GridCard key={p.product_id} product={p} />
            ))}
          </View>
        )}

        {loadingMore && (
          <View style={styles.footerLoad}>
            <ActivityIndicator />
          </View>
        )}
      </ScrollView>

      <FloatingHeader title="리스트" />
    </View>
  );
}

function GridCard({ product }: { product: ResultProduct }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        Haptic.light();
        router.push(`/product/${product.product_id}` as never);
      }}
    >
      <View style={styles.thumb}>
        {product.image_url ? (
          <Image
            source={product.image_url}
            style={styles.fill}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.fill, styles.thumbFallback]} />
        )}
      </View>
      <View style={styles.meta}>
        <Text style={styles.brand} numberOfLines={1}>
          {product.brand}
        </Text>
        {product.price != null && (
          <Text style={styles.price} numberOfLines={1}>
            {formatPrice(product.price)}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  body: {
    paddingHorizontal: 0,
  },
  headerBlock: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOSColors.label,
    marginRight: 8,
  },
  title: {
    ...IOSText.title2,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    flexShrink: 1,
  },
  countText: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
    marginLeft: 14,
  },
  // 3-col grid edge-to-edge (mirrors PDP similar grid).
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  card: {
    width: CARD_W,
  },
  thumb: {
    width: '100%',
    aspectRatio: 0.82,
    overflow: 'hidden',
    backgroundColor: IOSColors.tertiarySystemBackground,
    marginBottom: 2,
    position: 'relative',
  },
  fill: { width: '100%', height: '100%' },
  thumbFallback: {
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  meta: {
    paddingHorizontal: 8,
    gap: 1,
  },
  brand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  price: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  center: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 8,
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  mutedSmall: {
    ...IOSText.caption1,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.rounded,
  },
  footerLoad: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});
