import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { checkProductLink, getProduct, recordProductView } from '@/lib/products';
import { useCap } from '@/state/cap';
import { useWishlist } from '@/state/wishlist';
import type { ProductDetail, SimilarProduct } from '@/types/api';

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

// Display shape for the PDP similar grid. Initial set ships brand + price
// inline from the server (cosine endpoint); refine results come back as
// generic chat ProductRefs where only the caption is available, so we strip
// HTML and use the first segment as the brand fallback (price stays null).
type SimilarItem = {
  product_id: number | null;
  image_url: string;
  brand: string;
  price: number | null;
  original_price: number | null;
  sale_price: number | null;
};

function similarToItem(p: SimilarProduct): SimilarItem {
  return {
    product_id: p.id,
    image_url: p.image_url,
    brand: p.brand,
    price: p.price,
    original_price: p.original_price ?? null,
    sale_price: p.sale_price ?? null,
  };
}

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id, session, search_id } = useLocalSearchParams<{
    id: string;
    session?: string;
    search_id?: string;
  }>();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  // null = not yet checked; true = alive; false = dead. Disables CTA when false.
  const [linkAlive, setLinkAlive] = useState<boolean | null>(null);
  const [alternativeUrl, setAlternativeUrl] = useState<string | null>(null);
  // Similar-products feed — initial set lands inline on ProductDetail.similar
  // (server computes cosine distance directly on product_embeddings). The grid
  // can be refined by selecting cards and refiring an SSE chat anchored on
  // those picks, which is when `similarLoading` flips back on.
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  // 단일 anchor — 컴포저의 [이 제품 기준] 이 가리키는 상품. 페이지 진입 시
  // 메인 상품 id 로 초기화되고, 사용자가 비슷한 제품 카드나 메인 이미지 위
  // 체크박스를 탭하면 해당 상품 id 로 교체된다.
  const [anchorId, setAnchorId] = useState<number | null>(null);
  // Hero image natural aspect ratio (width / height). Falls back to the
  // historical 1:0.95 frame until the image reports its intrinsic size, so
  // the layout doesn't jump as drastically when the image finally loads.
  const [heroAspect, setHeroAspect] = useState<number>(SCREEN_W / HERO_HEIGHT);

  const { isSaved, toggle: toggleSaved } = useWishlist();
  const { locked: capLocked } = useCap();
  const productIdStr = product ? String(product.id) : '';
  const saved = productIdStr ? isSaved(productIdStr) : false;
  const canSend = !capLocked && text.trim().length > 0;

  // 현재 anchor 로 잡힌 상품의 pin 정보. 기본은 메인 상품이지만 사용자가
  // 비슷한 제품 카드를 anchor 로 지정하면 그 카드의 값을 쓴다.
  const anchorPin = useMemo((): {
    id: string;
    image_url: string;
    brand: string;
    name: string | null;
    price: number | null;
  } | null => {
    if (!product) return null;
    if (anchorId != null && anchorId !== Number(product.id)) {
      const s = similar.find((x) => x.product_id === anchorId);
      if (s) {
        return {
          id: String(s.product_id),
          image_url: s.image_url,
          brand: s.brand,
          name: null,
          price: s.price,
        };
      }
    }
    return {
      id: String(product.id),
      image_url: product.image_url,
      brand: product.brand,
      name: product.name,
      price: product.price,
    };
  }, [product, similar, anchorId]);

  // Hand the message + the anchor product as a pinned attachment off to
  // /home, which owns the chat surface. Home reads the seed/pin params, fires
  // the SSE turn there so the user sees the streaming response in the main
  // chat flow.
  const kickoffChat = useCallback(
    (msg: string) => {
      if (!anchorPin) return;
      Haptic.medium();
      const params: string[] = [`seed=${encodeURIComponent(msg)}`];
      if (session) params.push(`session=${encodeURIComponent(session)}`);
      if (anchorPin.image_url)
        params.push(`pin_image=${encodeURIComponent(anchorPin.image_url)}`);
      params.push(
        `pin_label=${encodeURIComponent(
          anchorPin.brand || anchorPin.name || '선택한 상품',
        )}`,
      );
      params.push(`pin_id=${encodeURIComponent(anchorPin.id)}`);
      if (anchorPin.name)
        params.push(`pin_name=${encodeURIComponent(anchorPin.name)}`);
      if (anchorPin.price != null)
        params.push(
          `pin_price=${encodeURIComponent(String(Math.round(anchorPin.price)))}`,
        );
      router.replace(`/home?${params.join('&')}` as never);
    },
    [anchorPin, session],
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
      const data = await getProduct(id, search_id ? { searchId: search_id } : undefined);
      setProduct(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '상품을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [id, search_id]);

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

  // Initial similar products come inline on the PDP response — no extra
  // round trip. Selecting cards + tapping the refine CTA below the grid
  // refires an SSE chat to anchor the next batch on those picks.
  useEffect(() => {
    if (!product) return;
    // 페이지 진입 시 anchor 는 메인 상품으로 초기화.
    setAnchorId(typeof product.id === "number" ? product.id : Number(product.id));
    // 서버 응답에 같은 product_id 카드가 여러 번 들어오거나 현재 상세 제품이
    // 그대로 섞여 오는 경우가 있어, 렌더 전에 dedupe + self-remove.
    const seen = new Set<number>();
    const items: SimilarItem[] = [];
    for (const raw of product.similar ?? []) {
      const item = similarToItem(raw);
      if (item.product_id == null) continue;
      if (String(item.product_id) === String(product.id)) continue;
      if (seen.has(item.product_id)) continue;
      seen.add(item.product_id);
      items.push(item);
    }
    setSimilar(items);
    setSimilarLoading(false);
  }, [product]);

  const handleBuy = useCallback(async () => {
    // Prefer the freshness-checked alternative when the original is dead.
    const target =
      linkAlive === false && alternativeUrl ? alternativeUrl : product?.product_url;
    if (!target) return;
    Haptic.medium();
    await Linking.openURL(target);
  }, [product, linkAlive, alternativeUrl]);

  // 비슷한 카드 / 메인 이미지의 체크박스 탭 → anchor 를 해당 id 로 교체.
  // 이미 anchor 인 항목을 다시 탭하면 메인 상품으로 되돌린다.
  const mainId = product ? Number(product.id) : null;
  const selectAnchor = useCallback(
    (pid: number) => {
      if (mainId == null) return;
      Haptic.selection();
      setAnchorId((prev) => (prev === pid ? mainId : pid));
    },
    [mainId],
  );

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
          {/* Hero — width matches the screen, height follows the image's
              own aspect ratio so nothing is cropped. */}
          <View style={[styles.hero, { height: SCREEN_W / heroAspect }]}>
            {heroImages[0] ? (
              <Image
                source={heroImages[0]}
                style={styles.heroImage}
                contentFit="contain"
                onLoad={(e) => {
                  const src = (e as { source?: { width?: number; height?: number } })
                    ?.source;
                  if (src?.width && src?.height) {
                    setHeroAspect(src.width / src.height);
                  }
                }}
              />
            ) : (
              <View style={[styles.heroImage, styles.heroFallback]} />
            )}
            {/* 체크 · 찜은 헤더가 아니라 상품 이미지 위(우하단)에 박아둠.
                back 만 상단 오버레이에 남아 sticky 로 스크롤을 견딤. */}
            <View style={styles.heroInlineActions}>
              {mainId != null && (
                <Pressable
                  hitSlop={8}
                  style={[
                    styles.heroInlineBtn,
                    anchorId === mainId && styles.heroInlineBtnOn,
                  ]}
                  onPress={() => selectAnchor(mainId)}
                >
                  <SymbolView
                    name="checkmark"
                    size={14}
                    tintColor={
                      anchorId === mainId
                        ? IOSColors.systemBackground
                        : 'rgba(255,255,255,0.75)'
                    }
                    weight="bold"
                  />
                </Pressable>
              )}
              <Pressable
                hitSlop={8}
                style={[styles.heroInlineBtn, saved && styles.heroInlineBtnOn]}
                onPress={() => {
                  if (!productIdStr) return;
                  Haptic.selection();
                  void toggleSaved(productIdStr);
                }}
              >
                <SymbolView
                  name={saved ? 'heart.fill' : 'heart'}
                  size={14}
                  tintColor={
                    saved
                      ? IOSColors.systemBackground
                      : 'rgba(255,255,255,0.85)'
                  }
                  weight="bold"
                />
              </Pressable>
            </View>
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
              checkbox to set that item as the composer anchor. */}
          <SimilarProducts
            items={similar}
            loading={similarLoading}
            anchorId={anchorId}
            onSelectAnchor={selectAnchor}
            session={session}
            searchId={search_id}
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
            {/* 캡 배너는 상세 페이지에서 노출 X — 홈/기존 채팅에서만 안내.
                여기선 컴포저만 잠기고 배너는 보이지 않도록. */}
            {/* 항상 1 Row 유지. 브랜드가 길면 말줄임표, 그래도 넘치면
                가로 스크롤로 흐르게 한다. */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.scopeChip}>
                {anchorPin?.image_url ? (
                  <Image
                    source={anchorPin.image_url}
                    style={styles.scopeThumb}
                    contentFit="cover"
                  />
                ) : (
                  <View style={[styles.scopeThumb, styles.heroFallback]} />
                )}
                <Text style={styles.scopeLabel}>이 제품 기준</Text>
                <Text style={styles.scopeBrand} numberOfLines={1}>
                  · {anchorPin?.brand ?? product.brand}
                </Text>
              </View>
              {CRITIQUE.map((c) => (
                <Pressable
                  key={c.id}
                  disabled={capLocked}
                  onPress={() => handleCritique(c.label)}
                >
                  <GlassSurface
                    variant="pill"
                    isInteractive={!capLocked}
                    style={[styles.critiqueChip, capLocked && { opacity: 0.4 }]}
                  >
                    <Text style={styles.critiqueText}>{c.label}</Text>
                  </GlassSurface>
                </Pressable>
              ))}
            </ScrollView>

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
                placeholder={
                  capLocked
                    ? "오늘 사용량이 다 소진됐어요"
                    : "이거랑 비슷한데 더 저렴하게..."
                }
                placeholderTextColor={IOSColors.placeholderText}
                style={styles.input}
                returnKeyType="send"
                onSubmitEditing={handleComposerSend}
                editable={!capLocked}
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
// corner check toggle selects the card as the SINGLE composer anchor
// (replacing whatever was previously anchored — main product or another
// similar item). Multi-select is intentionally not supported.

function SimilarProducts({
  items,
  loading,
  anchorId,
  onSelectAnchor,
  session,
  searchId,
}: {
  items: SimilarItem[];
  loading: boolean;
  anchorId: number | null;
  onSelectAnchor: (productId: number) => void;
  /** 세션 유지용 — 자식 PDP 로 넘겨서 새 세션이 뜨는 걸 방지. */
  session?: string;
  searchId?: string;
}) {
  const { isSaved, toggle: toggleSaved } = useWishlist();
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
              const checked = p.product_id != null && anchorId === p.product_id;
              return (
                <Pressable
                  key={`${p.product_id ?? idx}-${p.image_url}`}
                  style={styles.similarCard}
                  disabled={p.product_id == null}
                  onPress={() => {
                    if (p.product_id == null) return;
                    Haptic.light();
                    // 세션·서치 컨텍스트 유지. 그래야 다음 PDP 에서
                    // critique 눌러도 새 세션이 안 생기고 이어감.
                    const qs = [
                      session
                        ? `session=${encodeURIComponent(session)}`
                        : "",
                      searchId
                        ? `search_id=${encodeURIComponent(searchId)}`
                        : "",
                    ]
                      .filter(Boolean)
                      .join("&");
                    const url = qs
                      ? `/product/${p.product_id}?${qs}`
                      : `/product/${p.product_id}`;
                    router.push(url as never);
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
                      <View style={styles.similarActions}>
                        <Pressable
                          hitSlop={8}
                          style={[
                            styles.similarCheck,
                            checked && styles.similarCheckOn,
                          ]}
                          onPress={() => onSelectAnchor(p.product_id as number)}
                        >
                          <SymbolView
                            name="checkmark"
                            size={11}
                            // on 상태 bg 는 IOSColors.label (다크모드에선 흰
                            // 색) 이라 흰 아이콘이 사라짐. systemBackground
                            // 로 반대색 유지.
                            tintColor={
                              checked
                                ? IOSColors.systemBackground
                                : "rgba(255,255,255,0.7)"
                            }
                            weight="bold"
                          />
                        </Pressable>
                        {(() => {
                          const pidStr = String(p.product_id);
                          const savedFlag = isSaved(pidStr);
                          return (
                            <Pressable
                              hitSlop={8}
                              style={[
                                styles.similarCheck,
                                savedFlag && styles.similarCheckOn,
                              ]}
                              onPress={() => {
                                Haptic.selection();
                                void toggleSaved(pidStr);
                              }}
                            >
                              <SymbolView
                                name={savedFlag ? 'heart.fill' : 'heart'}
                                size={11}
                                tintColor={
                                  savedFlag
                                    ? IOSColors.systemBackground
                                    : 'rgba(255,255,255,0.85)'
                                }
                                weight="bold"
                              />
                            </Pressable>
                          );
                        })()}
                      </View>
                    )}
                  </View>
                  <View style={styles.similarMeta}>
                    <Text style={styles.similarBrand} numberOfLines={1}>
                      {p.brand}
                    </Text>
                    {p.sale_price != null && p.original_price != null ? (
                      <>
                        <Text style={styles.similarPriceOriginal} numberOfLines={1}>
                          {formatPrice(p.original_price)}
                        </Text>
                        <Text style={styles.similarPriceSale} numberOfLines={1}>
                          {formatPrice(p.sale_price)}
                        </Text>
                      </>
                    ) : (
                      p.price != null && (
                        <Text style={styles.similarPrice} numberOfLines={1}>
                          {formatPrice(p.price)}
                        </Text>
                      )
                    )}
                  </View>
                </Pressable>
              );
            })}
      </View>
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
    backgroundColor: IOSColors.systemBackground,
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
  // 상품 이미지 위에 박히는 액션 클러스터. 순서 [체크, 찜], 우하단.
  heroInlineActions: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroInlineBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInlineBtnOn: {
    backgroundColor: IOSColors.label,
    borderColor: IOSColors.label,
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
    fontFamily: IOSFont.sans,
  },
  name: {
    ...IOSText.title2,
    color: IOSColors.label,
    marginTop: 2,
    fontFamily: IOSFont.sans,
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
    fontFamily: IOSFont.sans,
  },
  priceOriginal: {
    ...IOSText.subhead,
    color: IOSColors.tertiaryLabel,
    textDecorationLine: 'line-through',
    fontFamily: IOSFont.sans,
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
    alignItems: 'center',
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
    // 브랜드가 매우 길 때 chip 이 컴포저 폭을 다 잡아먹지 않도록 상한.
    maxWidth: 120,
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
  // 3-col grid edge-to-edge — no side padding, no column gap. Cards butt up
  // against each other and the screen edges.
  similarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  similarCard: {
    width: SCREEN_W / 3,
  },
  similarThumb: {
    width: '100%',
    aspectRatio: 0.82,
    overflow: 'hidden',
    backgroundColor: IOSColors.tertiarySystemBackground,
    marginBottom: 2,
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
  // 우상단 액션 스택 — [체크, 찜]. 개별 버튼은 similarCheck 스타일 재사용.
  similarActions: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  similarCheck: {
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
  similarMeta: {
    paddingHorizontal: 8,
    gap: 1,
  },
  similarBrand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  similarPrice: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  similarPriceOriginal: {
    ...IOSText.caption1,
    color: IOSColors.tertiaryLabel,
    textDecorationLine: 'line-through',
    fontFamily: IOSFont.rounded,
  },
  similarPriceSale: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.systemRed,
    fontFamily: IOSFont.rounded,
  },
});
