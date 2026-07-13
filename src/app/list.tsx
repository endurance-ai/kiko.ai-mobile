import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { GlassSurface } from '@/components/glass-surface';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { trackProductImpression } from '@/lib/analytics';
import { ApiError } from '@/lib/api';
import { getResultSetPage } from '@/lib/results';
import { useBanner } from '@/state/banner';
import { useCap } from '@/state/cap';
import { formatPrice } from '@/state/products';
import { useWishlist } from '@/state/wishlist';
import type { ResultProduct, ResultSetPageResponse } from '@/types/api';

// Edge-to-edge 3-col grid (mirrors PDP similar grid — no side padding, no
// column gap, tile width = SCREEN_W / 3, thumb aspect 0.82).
const SCREEN_W = Dimensions.get('window').width;
const CARD_W = SCREEN_W / 3;
const PAGE_LIMIT = 60;

export default function ListScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ search?: string; session?: string }>();
  const searchId = (params.search as string | undefined) || null;
  const sessionId = (params.session as string | undefined) || null;
  const { show: showBanner } = useBanner();
  const { locked: capLocked } = useCap();

  const [page, setPage] = useState<ResultSetPageResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);
  const [errored, setErrored] = useState<boolean>(false);
  const [text, setText] = useState('');
  // 카드에서 체크한 상품 — PDP 의 anchor 와 동일한 개념. 컴포저에서 send
  // 하면 이 상품을 pin 으로 실어 홈으로 넘긴다.
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);
  const canSend = !capLocked && text.trim().length > 0;
  const items = page?.items ?? [];
  const pinnedProduct = pinnedProductId
    ? items.find((p) => String(p.product_id) === pinnedProductId) ?? null
    : null;

  // 컴포저 send — 리스트 컨텍스트를 통째로 홈에 넘긴다:
  //   - session: 있으면 기존 스레드 이어감
  //   - list_search_id: 이번 결과 세트 (홈 → 서버는 향후 이 컨텍스트로 리파인)
  //   - pin_*: 카드에서 체크한 상품이 있으면 [이 제품 기준] 으로 anchor
  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || capLocked) return;
    Haptic.medium();
    setText('');
    const qs: string[] = [`seed=${encodeURIComponent(trimmed)}`];
    if (sessionId) qs.push(`session=${encodeURIComponent(sessionId)}`);
    if (searchId) qs.push(`list_search_id=${encodeURIComponent(searchId)}`);
    if (pinnedProduct) {
      const pid = String(pinnedProduct.product_id);
      qs.push(`pin_id=${encodeURIComponent(pid)}`);
      qs.push(
        `pin_label=${encodeURIComponent(pinnedProduct.brand || '선택한 상품')}`,
      );
      if (pinnedProduct.image_url)
        qs.push(`pin_image=${encodeURIComponent(pinnedProduct.image_url)}`);
      if (pinnedProduct.price != null)
        qs.push(
          `pin_price=${encodeURIComponent(
            String(Math.round(pinnedProduct.price)),
          )}`,
        );
    }
    router.push(`/home?${qs.join('&')}` as never);
  };

  const togglePinnedProduct = (productId: string) => {
    if (capLocked) return;
    Haptic.selection();
    setPinnedProductId((prev) => (prev === productId ? null : productId));
  };

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

  const title = page?.title ?? '검색 결과';
  const count = page?.result_count ?? items.length;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          {
            paddingTop: insets.top + FLOATING_HEADER_OFFSET,
            // 컴포저가 하단에 float 하므로 그리드 마지막 행이 안 가려지게
            // 여유. safe area + composer(56) + margin ~= 110.
            paddingBottom: insets.bottom + 110,
          },
        ]}
        onScrollEndDrag={loadMore}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
            {items.map((p, idx) => {
              const pidStr = String(p.product_id);
              return (
                <GridCard
                  key={p.product_id}
                  product={p}
                  sessionId={sessionId}
                  searchId={searchId}
                  position={idx}
                  pinned={pinnedProductId === pidStr}
                  onTogglePin={() => togglePinnedProduct(pidStr)}
                />
              );
            })}
          </View>
        )}

        {loadingMore && (
          <View style={styles.footerLoad}>
            <ActivityIndicator />
          </View>
        )}
      </ScrollView>

      <FloatingHeader title="리스트" />

      {/* Composer — 홈/PDP 와 같은 하단 float. 세션 컨텍스트를 유지하면서
          검색 결과 리스트를 보면서 이어서 쿼리할 수 있게 한다. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.composerFloat}
        pointerEvents="box-none"
      >
        <View style={[styles.composerWrap, { paddingBottom: insets.bottom + 12 }]}>
          {pinnedProduct && !capLocked && (
            <View style={styles.pinChipRow}>
              <View style={styles.pinChip}>
                {pinnedProduct.image_url ? (
                  <Image
                    source={pinnedProduct.image_url}
                    style={styles.pinThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.pinThumb, styles.thumbFallback]} />
                )}
                <Text style={styles.pinLabel} numberOfLines={1}>
                  {pinnedProduct.brand || '선택한 상품'}
                </Text>
                <Pressable
                  hitSlop={6}
                  onPress={() => setPinnedProductId(null)}
                >
                  <SymbolView
                    name="xmark.circle.fill"
                    size={18}
                    tintColor={IOSColors.tertiaryLabel}
                  />
                </Pressable>
              </View>
            </View>
          )}
          <GlassSurface variant="composer" style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={
                capLocked
                  ? '오늘 사용량이 다 소진됐어요'
                  : '이 리스트에서 이어서 찾아볼까?'
              }
              placeholderTextColor={IOSColors.placeholderText}
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={handleSend}
              editable={!capLocked}
            />
            <Pressable
              hitSlop={6}
              disabled={!canSend}
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={handleSend}
            >
              <SymbolView
                name="arrow.up"
                size={18}
                tintColor={IOSColors.systemBackground}
                weight="bold"
              />
            </Pressable>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function GridCard({
  product,
  sessionId,
  searchId,
  position,
  pinned,
  onTogglePin,
}: {
  product: ResultProduct;
  sessionId: string | null;
  searchId: string | null;
  position: number;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { isSaved, toggle: toggleSaved } = useWishlist();
  const productIdStr = String(product.product_id);
  const saved = isSaved(productIdStr);

  useEffect(() => {
    trackProductImpression({
      productId: productIdStr,
      brand: product.brand,
      searchId,
      position,
      source: "search",
    });
  }, [productIdStr, product.brand, searchId, position]);
  const openPdp = () => {
    Haptic.light();
    const qs = [
      sessionId ? `session=${encodeURIComponent(sessionId)}` : '',
      searchId ? `search_id=${encodeURIComponent(searchId)}` : '',
    ]
      .filter(Boolean)
      .join('&');
    const url = qs
      ? `/product/${product.product_id}?${qs}`
      : `/product/${product.product_id}`;
    router.push(url as never);
  };
  return (
    <Pressable style={styles.card} onPress={openPdp}>
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
        <View style={styles.cardActions}>
          <Pressable
            hitSlop={8}
            style={[styles.checkBtn, pinned && styles.checkBtnOn]}
            onPress={onTogglePin}
          >
            <SymbolView
              name="checkmark"
              size={11}
              tintColor={
                pinned ? IOSColors.systemBackground : 'rgba(255,255,255,0.7)'
              }
              weight="bold"
            />
          </Pressable>
          <Pressable
            hitSlop={8}
            style={[styles.heartBtn, saved && styles.heartBtnOn]}
            onPress={() => {
              Haptic.selection();
              void toggleSaved(productIdStr);
            }}
          >
            <SymbolView
              name={saved ? 'heart.fill' : 'heart'}
              size={12}
              tintColor={
                saved ? IOSColors.systemBackground : 'rgba(255,255,255,0.85)'
              }
              weight="bold"
            />
          </Pressable>
        </View>
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
    fontFamily: IOSFont.sans,
    flexShrink: 1,
  },
  countText: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
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
  // 우상단 액션 클러스터 — 순서: [체크(anchor pin), 찜]. 홈/PDP 와 통일.
  cardActions: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(0,0,0,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkBtnOn: {
    backgroundColor: IOSColors.label,
    borderColor: IOSColors.label,
  },
  heartBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(0,0,0,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heartBtnOn: {
    backgroundColor: IOSColors.label,
    borderColor: IOSColors.label,
  },
  meta: {
    paddingHorizontal: 8,
    gap: 1,
  },
  brand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  price: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  center: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 8,
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  mutedSmall: {
    ...IOSText.caption1,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },
  footerLoad: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  // ── Composer (하단 float) ─────────────────────────────────────
  composerFloat: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  composerWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  // pin chip (선택된 상품 프리뷰) — 컴포저 바로 위. 홈의 pinnedAttachment 와
  // 동일 스타일 언어.
  pinChipRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  pinChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  pinThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  pinLabel: {
    ...IOSText.footnote,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    maxWidth: 160,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    paddingLeft: 16,
    paddingRight: 6,
    overflow: 'hidden',
  },
  input: {
    flex: 1,
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: IOSColors.systemGray3,
  },
});
