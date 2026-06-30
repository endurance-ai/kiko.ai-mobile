import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { ApiError } from '@/lib/api';
import { createSessionStream } from '@/lib/chat';
import { checkProductLink, getProduct, recordProductView } from '@/lib/products';
import type { ChatStreamController } from '@/lib/sse';
import { useWishlist } from '@/state/wishlist';
import type { ProductDetail, ProductRef } from '@/types/api';

const SCREEN_W = Dimensions.get('window').width;
const HERO_HEIGHT = Math.round(SCREEN_W * 0.95);

const CRITIQUE = [
  { id: 'sim', label: '더 비슷하게' },
  { id: 'cheap', label: '더 저렴하게' },
];

function formatPrice(price: number | null): string {
  if (price === null || Number.isNaN(price)) return '';
  return `₩${Math.round(price).toLocaleString('ko-KR')}`;
}

// In-memory cache for similar-product feeds keyed by product id. Lives at
// module scope so it survives PDP unmount/remount within the same app run —
// re-opening a PDP shows the previous list instantly while a stale entry
// past TTL refires the SSE in the background. Cleared on app reload.
const SIMILAR_CACHE_TTL_MS = 10 * 60_000; // 10 minutes
type SimilarCacheEntry = { items: ProductRef[]; fetchedAt: number };
const similarCache = new Map<string, SimilarCacheEntry>();

function readSimilarCache(productId: string): ProductRef[] | null {
  const entry = similarCache.get(productId);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > SIMILAR_CACHE_TTL_MS) {
    similarCache.delete(productId);
    return null;
  }
  return entry.items;
}

function writeSimilarCache(productId: string, items: ProductRef[]): void {
  if (items.length === 0) return; // don't memoize empty / failed runs
  similarCache.set(productId, { items, fetchedAt: Date.now() });
}

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, session } = useLocalSearchParams<{ id: string; session?: string }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  // null = not yet checked; true = alive; false = dead. Disables CTA when false.
  const [linkAlive, setLinkAlive] = useState<boolean | null>(null);
  const [alternativeUrl, setAlternativeUrl] = useState<string | null>(null);
  // Similar-products feed — sourced from a background SSE chat anchored on
  // the current product (no dedicated endpoint yet, so we reuse the chat
  // recommendation pipeline). Stays empty until the first onProduct fires.
  const [similar, setSimilar] = useState<ProductRef[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  // Tracks which similar cards the user has ticked. Tapping the action
  // button below the grid refires the search with these as anchors.
  const [selectedSimilar, setSelectedSimilar] = useState<Set<number>>(new Set());
  const similarStreamRef = useRef<ChatStreamController | null>(null);

  const { isSaved, toggle: toggleSaved } = useWishlist();
  const productIdStr = product ? String(product.id) : '';
  const saved = productIdStr ? isSaved(productIdStr) : false;
  const canSend = text.trim().length > 0;

  // Hand the message + this product as a pinned attachment off to /home, which
  // owns the chat surface. Home reads the seed/pin params, fires the SSE turn
  // there so the user sees the streaming response in the main chat flow.
  const kickoffChat = useCallback(
    (msg: string) => {
      if (!product) return;
      Haptic.medium();
      const params: string[] = [`seed=${encodeURIComponent(msg)}`];
      if (session) params.push(`session=${encodeURIComponent(session)}`);
      if (product.image_url)
        params.push(`pin_image=${encodeURIComponent(product.image_url)}`);
      params.push(
        `pin_label=${encodeURIComponent(product.brand || product.name || '선택한 상품')}`,
      );
      params.push(`pin_id=${encodeURIComponent(String(product.id))}`);
      if (product.name) params.push(`pin_name=${encodeURIComponent(product.name)}`);
      if (product.price != null)
        params.push(`pin_price=${encodeURIComponent(String(Math.round(product.price)))}`);
      router.replace(`/home?${params.join('&')}` as never);
    },
    [product, session],
  );

  const handleCritique = useCallback(
    (label: string) => {
      kickoffChat(label);
    },
    [kickoffChat],
  );

  const handleComposerSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    kickoffChat(trimmed);
  }, [text, kickoffChat]);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setError(null);
      setLoading(true);
      const data = await getProduct(id);
      setProduct(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '상품을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Record view (fire-and-forget) when product loaded and we know the session.
  useEffect(() => {
    if (!product || !session) return;
    void recordProductView(product.id, { session_id: session }).catch(() => {
      // 24h dedup or transient failure — silent
    });
  }, [product, session]);

  // Background link-check — dead-link / 404 catches stale catalog rows so we
  // don't dump users into a broken external page. Fail-open: leave the CTA
  // enabled if the check itself errors.
  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await checkProductLink(product.id);
        if (cancelled) return;
        setLinkAlive(res.alive);
        setAlternativeUrl(res.alternative_url ?? null);
      } catch {
        if (!cancelled) setLinkAlive(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product]);

  // Similar products — fire a hidden chat turn anchored on this product and
  // collect the SSE `product` events. Reuses the existing recommendation
  // pipeline so there's no dedicated `/v1/products/{id}/similar` to wait for.
  // Cache hits short-circuit the SSE so PDP revisits feel instant.
  // Trade-off: each cache miss creates a session on the server; revisit
  // when a `silent`/`inline_only` flag lands on /v1/chat.
  useEffect(() => {
    if (!product) return;
    const pid = String(product.id);

    const cached = readSimilarCache(pid);
    if (cached) {
      setSimilar(cached);
      setSelectedSimilar(new Set());
      setSimilarLoading(false);
      return;
    }

    setSimilar([]);
    setSelectedSimilar(new Set());
    setSimilarLoading(true);
    const collected: ProductRef[] = [];
    const priceLabel = product.price
      ? ` · ₩${Math.round(product.price).toLocaleString('ko-KR')}`
      : '';
    const anchorPrefix = `[#${product.id} · ${product.brand} · ${product.name}${priceLabel}]`;
    const message = `${anchorPrefix} 이거랑 비슷한 거 보여줘`;
    const ctrl = createSessionStream(message, {
      onProduct: (p) => {
        // Skip the anchor itself if it slips back in the result set.
        if (p.product_id != null && String(p.product_id) === pid) return;
        collected.push(p);
        setSimilar((prev) => [...prev, p]);
      },
      onDone: () => {
        setSimilarLoading(false);
        writeSimilarCache(pid, collected);
      },
      onError: () => setSimilarLoading(false),
    });
    similarStreamRef.current = ctrl;
    return () => {
      ctrl.cancel();
      similarStreamRef.current = null;
    };
  }, [product]);

  const handleBuy = useCallback(async () => {
    // Prefer the freshness-checked alternative when the original is dead.
    const target =
      linkAlive === false && alternativeUrl ? alternativeUrl : product?.product_url;
    if (!target) return;
    Haptic.medium();
    await Linking.openURL(target);
  }, [product, linkAlive, alternativeUrl]);

  const toggleSimilarSelected = useCallback((pid: number) => {
    Haptic.selection();
    setSelectedSimilar((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }, []);

  // Refire the similar feed using every ticked card as an anchor. The chat
  // pipeline sees a multi-anchor prefix and converges on items that match
  // the *combined* feel of the user's picks.
  const refineWithSelected = useCallback(() => {
    if (!product || selectedSimilar.size === 0) return;
    const anchors = similar.filter(
      (p) => p.product_id != null && selectedSimilar.has(p.product_id),
    );
    if (anchors.length === 0) return;

    Haptic.medium();
    similarStreamRef.current?.cancel();

    const anchorTokens = anchors
      .map((p) => {
        const caption = (p.caption || '').replace(/<[^>]+>/g, '').trim();
        return `#${p.product_id}${caption ? ' · ' + caption : ''}`;
      })
      .join(', ');
    const message = `[${anchorTokens}] 이거랑 비슷한 거 보여줘`;

    setSimilar([]);
    setSelectedSimilar(new Set());
    setSimilarLoading(true);
    const collected: ProductRef[] = [];
    const ctrl = createSessionStream(message, {
      onProduct: (p) => {
        // Skip both the page's product and any anchor that comes back.
        if (
          p.product_id != null &&
          (String(p.product_id) === String(product.id) ||
            anchors.some((a) => a.product_id === p.product_id))
        ) {
          return;
        }
        collected.push(p);
        setSimilar((prev) => [...prev, p]);
      },
      onDone: () => {
        setSimilarLoading(false);
        // Cache under a synthetic key so the new feed survives a quick
        // back-and-forth; doesn't collide with the base product's cache.
        const refineKey = `${product.id}::${[...anchors.map((a) => a.product_id)].sort().join('-')}`;
        writeSimilarCache(refineKey, collected);
      },
      onError: () => setSimilarLoading(false),
    });
    similarStreamRef.current = ctrl;
  }, [product, similar, selectedSimilar]);

  const heroImages = product?.images && product.images.length > 0
    ? product.images
    : product?.image_url
      ? [product.image_url]
      : [];

  return (
    <View style={styles.root}>
      {loading && (
        <View style={styles.fullCenter}>
          <ActivityIndicator />
        </View>
      )}

      {error && !loading && (
        <View style={styles.fullCenter}>
          <Text style={styles.muted}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retry}>
            <Text style={styles.retryText}>다시 시도</Text>
          </Pressable>
        </View>
      )}

      {product && !loading && (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + 180 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero */}
          <View style={styles.hero}>
            {heroImages[0] ? (
              <Image source={heroImages[0]} style={styles.heroImage} contentFit="cover" />
            ) : (
              <View style={[styles.heroImage, styles.heroFallback]} />
            )}

            {heroImages.length > 1 && (
              <View style={styles.dots}>
                {heroImages.map((_, i) => (
                  <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
                ))}
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.brand}>{product.brand}</Text>
            <Text style={styles.name}>{product.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatPrice(product.price)}</Text>
              {product.original_price && product.sale_price && (
                <Text style={styles.priceOriginal}>
                  {formatPrice(product.original_price)}
                </Text>
              )}
            </View>
            {!product.in_stock && (
              <Text style={styles.staleNotice}>품절 또는 판매 종료</Text>
            )}
            {linkAlive === false && !alternativeUrl && (
              <Text style={styles.staleNotice}>
                판매 페이지를 더는 열 수 없어요
              </Text>
            )}
            {linkAlive === false && alternativeUrl && (
              <Text style={styles.staleNotice}>
                대체 페이지로 연결될 거예요
              </Text>
            )}
          </View>

          {/* CTA */}
          <View style={styles.ctaWrap}>
            {(() => {
              const targetUrl =
                linkAlive === false && alternativeUrl
                  ? alternativeUrl
                  : product.product_url;
              const ctaDisabled = !targetUrl || (linkAlive === false && !alternativeUrl);
              return (
                <Pressable
                  style={[styles.cta, ctaDisabled && styles.ctaDisabled]}
                  onPress={handleBuy}
                  disabled={ctaDisabled}
                >
                  <Text style={styles.ctaText}>구매하러 가기</Text>
                  <SymbolView
                    name="chevron.right"
                    size={16}
                    tintColor={IOSColors.systemBackground}
                    weight="bold"
                  />
                </Pressable>
              );
            })()}
          </View>

          {/* Similar products — populated from a background SSE chat
              anchored on this product. Tap a card to navigate, tap the
              checkmark to refine the feed with that pick. */}
          <SimilarProducts
            items={similar}
            loading={similarLoading}
            selectedIds={selectedSimilar}
            onToggle={toggleSimilarSelected}
            onRefine={refineWithSelected}
          />

        </ScrollView>
      )}

      {/* Sticky top buttons — outside the ScrollView so they stay anchored
          to the screen as the user scrolls past the hero. */}
      {product && (
        <View
          style={[styles.heroOverlayFixed, { top: insets.top + 4 }]}
          pointerEvents="box-none"
        >
          <Pressable
            hitSlop={8}
            onPress={() => {
              Haptic.light();
              router.back();
            }}
          >
            <GlassSurface variant="pill" isInteractive style={styles.heroBtn}>
              <SymbolView
                name="chevron.left"
                size={18}
                tintColor={IOSColors.label}
                weight="semibold"
              />
            </GlassSurface>
          </Pressable>
          <Pressable
            hitSlop={8}
            onPress={() => {
              if (!productIdStr) return;
              Haptic.selection();
              void toggleSaved(productIdStr);
            }}
          >
            <GlassSurface variant="pill" isInteractive style={styles.heroBtn}>
              <SymbolView
                name={saved ? 'heart.fill' : 'heart'}
                size={18}
                tintColor={saved ? IOSColors.systemRed : IOSColors.label}
                weight="medium"
              />
            </GlassSurface>
          </Pressable>
        </View>
      )}

      {/* Composer */}
      {product && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.composerFloat}
          pointerEvents="box-none"
        >
          <View style={[styles.composerWrap, { paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.chipRow}>
              <View style={styles.scopeChip}>
                {product.image_url ? (
                  <Image
                    source={product.image_url}
                    style={styles.scopeThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.scopeThumb, styles.heroFallback]} />
                )}
                <Text style={styles.scopeLabel}>이 제품 기준</Text>
                <Text style={styles.scopeBrand}>· {product.brand}</Text>
              </View>
              {CRITIQUE.map((c) => (
                <Pressable key={c.id} onPress={() => handleCritique(c.label)}>
                  <GlassSurface variant="pill" isInteractive style={styles.critiqueChip}>
                    <Text style={styles.critiqueText}>{c.label}</Text>
                  </GlassSurface>
                </Pressable>
              ))}
            </View>

            <GlassSurface variant="composer" style={styles.composer}>
              <Pressable
                hitSlop={6}
                style={styles.composerIcon}
                onPress={() => Haptic.light()}
              >
                <SymbolView
                  name="plus"
                  size={20}
                  tintColor={IOSColors.secondaryLabel}
                  weight="medium"
                />
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="이거랑 비슷한데 더 저렴하게..."
                placeholderTextColor={IOSColors.placeholderText}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={handleComposerSend}
              />
              <Pressable
                hitSlop={6}
                disabled={!canSend}
                style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
                onPress={handleComposerSend}
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
      )}
    </View>
  );
}

// ─── Similar products section ────────────────────────────────────────────
// 3-col grid of cards fed by the background SSE turn fired in the parent.
// Each card has two tap zones: the body navigates into the card's PDP, the
// corner check toggle selects the card as an anchor for a refined search.
// The bottom action button refires the SSE with every ticked card.

function SimilarProducts({
  items,
  loading,
  selectedIds,
  onToggle,
  onRefine,
}: {
  items: ProductRef[];
  loading: boolean;
  selectedIds: Set<number>;
  onToggle: (productId: number) => void;
  onRefine: () => void;
}) {
  const selectedCount = selectedIds.size;
  const isEmpty = items.length === 0;
  // Skeleton tiles during loading (or before the SSE has fired) keep the
  // grid scaffold visible so the layout doesn't pop in. Six tiles = two
  // rows in a 3-col grid.
  if (isEmpty) {
    return (
      <View style={styles.similarBlock}>
        <Text style={styles.similarHeader}>비슷한 제품</Text>
        <View style={styles.similarGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <View key={`skeleton-${i}`} style={styles.similarCard}>
              <View style={[styles.similarThumb, styles.similarSkeleton]} />
            </View>
          ))}
        </View>
        {!loading && (
          <Text style={styles.similarEmptyHint}>
            아직 비슷한 제품을 못 찾았어요
          </Text>
        )}
      </View>
    );
  }
  return (
    <View style={styles.similarBlock}>
      <Text style={styles.similarHeader}>비슷한 제품</Text>
      <View style={styles.similarGrid}>
        {items.map((p, idx) => {
              const checked = p.product_id != null && selectedIds.has(p.product_id);
              return (
                <Pressable
                  key={`${p.product_id ?? idx}-${p.image_url}`}
                  style={styles.similarCard}
                  disabled={p.product_id == null}
                  onPress={() => {
                    if (p.product_id == null) return;
                    Haptic.light();
                    router.push(`/product/${p.product_id}` as never);
                  }}
                >
                  <View style={styles.similarThumb}>
                    {p.image_url ? (
                      <Image
                        source={p.image_url}
                        style={styles.similarFill}
                        contentFit="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.similarFill,
                          { backgroundColor: IOSColors.tertiarySystemBackground },
                        ]}
                      />
                    )}
                    {p.product_id != null && (
                      <Pressable
                        hitSlop={8}
                        style={[
                          styles.similarCheck,
                          checked && styles.similarCheckOn,
                        ]}
                        onPress={() => onToggle(p.product_id as number)}
                      >
                        {checked && (
                          <SymbolView
                            name="checkmark"
                            size={11}
                            tintColor="#FFFFFF"
                            weight="bold"
                          />
                        )}
                      </Pressable>
                    )}
                  </View>
                  <Text style={styles.similarBrand} numberOfLines={1}>
                    {(p.caption || '').replace(/<[^>]+>/g, '')}
                  </Text>
                </Pressable>
              );
            })}
      </View>
      {selectedCount > 0 && (
        <Pressable
          style={styles.similarRefineCta}
          onPress={onRefine}
          disabled={loading}
        >
          <Text style={styles.similarRefineText}>
            선택한 {selectedCount}개와 비슷한 거 보기
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.secondarySystemBackground,
  },

  fullCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  retry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  retryText: {
    ...IOSText.callout,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  // Hero
  hero: {
    width: SCREEN_W,
    height: HERO_HEIGHT,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroFallback: {
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  heroOverlayFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 60,
  },
  heroBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dots: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  dotActive: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },

  info: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  brand: {
    ...IOSText.subhead,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.rounded,
  },
  name: {
    ...IOSText.title2,
    color: IOSColors.label,
    marginTop: 2,
    fontFamily: IOSFont.rounded,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    marginTop: 10,
  },
  price: {
    ...IOSText.title2,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  priceOriginal: {
    ...IOSText.subhead,
    color: IOSColors.tertiaryLabel,
    textDecorationLine: 'line-through',
    fontFamily: IOSFont.rounded,
  },
  staleNotice: {
    ...IOSText.footnote,
    color: IOSColors.systemRed,
    marginTop: 8,
    fontFamily: IOSFont.rounded,
  },

  ctaWrap: {
    paddingHorizontal: 20,
    paddingTop: 18,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 56,
    borderRadius: 28,
    backgroundColor: IOSColors.label,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },

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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 4,
    gap: 8,
  },
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  scopeThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  scopeLabel: {
    ...IOSText.footnote,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  scopeBrand: {
    ...IOSText.footnote,
    fontWeight: '500',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  critiqueChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  critiqueText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 28,
    paddingLeft: 8,
    paddingRight: 6,
    overflow: 'hidden',
  },
  composerIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    ...IOSText.body,
    color: IOSColors.label,
    paddingHorizontal: 6,
    fontFamily: IOSFont.rounded,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.35,
  },

  // Similar products section (below CTA)
  similarBlock: {
    marginTop: 28,
    marginBottom: 24,
  },
  similarHeader: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  similarLoadingRow: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'flex-start',
  },
  // 3-col grid: ~32% width with row + column gaps via `gap`.
  similarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    columnGap: 8,
    rowGap: 16,
  },
  similarCard: {
    // 3-col grid: 16 side padding + 8 col gap × 2
    width: (SCREEN_W - 16 * 2 - 8 * 2) / 3,
  },
  similarThumb: {
    width: '100%',
    aspectRatio: 0.82, // ~130:160 — same proportion as the old horizontal card
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: IOSColors.tertiarySystemBackground,
    marginBottom: 8,
    position: 'relative',
  },
  similarFill: { width: '100%', height: '100%' },
  similarSkeleton: {
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  similarEmptyHint: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.rounded,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  // Check toggle (top-right of thumb). Empty circle when off, solid + check
  // when on. Sits above the image with a subtle translucent halo.
  similarCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarCheckOn: {
    backgroundColor: IOSColors.label,
    borderColor: IOSColors.label,
  },
  similarBrand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  // Refine CTA shown below the grid when at least one card is ticked.
  similarRefineCta: {
    marginTop: 16,
    marginHorizontal: 20,
    height: 46,
    borderRadius: 14,
    backgroundColor: IOSColors.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  similarRefineText: {
    ...IOSText.subhead,
    fontWeight: '700',
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
});
