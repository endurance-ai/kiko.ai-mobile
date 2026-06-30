import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
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
import { useWishlist } from '@/state/wishlist';
import type { ProductDetail } from '@/types/api';

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

  const handleBuy = useCallback(async () => {
    // Prefer the freshness-checked alternative when the original is dead.
    const target =
      linkAlive === false && alternativeUrl ? alternativeUrl : product?.product_url;
    if (!target) return;
    Haptic.medium();
    await Linking.openURL(target);
  }, [product, linkAlive, alternativeUrl]);

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

            <View
              style={[styles.heroOverlay, { top: insets.top + 4 }]}
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

        </ScrollView>
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
                  name="arrow.right"
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
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
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
});
