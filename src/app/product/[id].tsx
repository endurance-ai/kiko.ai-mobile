import { GlassView } from 'expo-glass-effect';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
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

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { findProduct, formatPrice, MOCK_PRODUCTS, type Product } from '@/state/products';
import { useWishlist } from '@/state/wishlist';

const SCREEN_W = Dimensions.get('window').width;
const HERO_HEIGHT = Math.round(SCREEN_W * 0.95);
const GRID_PADDING = 20;
const GRID_GAP = 10;
const SIM_CARD_W = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

const CRITIQUE = [
  { id: 'sim', label: '더 비슷하게' },
  { id: 'cheap', label: '더 저렴하게' },
];

export default function ProductDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const product = useMemo(() => findProduct(id), [id]);
  const similar = useMemo<Product[]>(
    () =>
      Array.from({ length: 12 }, (_, i) => ({
        ...MOCK_PRODUCTS[(i + 1) % MOCK_PRODUCTS.length],
        id: `sim-${id}-${i}`,
      })),
    [id],
  );

  const { isSaved, toggle: toggleSaved } = useWishlist();
  const saved = isSaved(product.id);
  const [whyExpanded, setWhyExpanded] = useState(false);
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 180 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroImage, { backgroundColor: product.colorHint }]} />

          {/* Overlay controls — anchored to hero top via insets, not SafeAreaView,
              so the row can't be pushed into the info section by layout quirks. */}
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
              <GlassView glassEffectStyle="clear" style={styles.heroBtn}>
                <SymbolView
                  name="chevron.left"
                  size={18}
                  tintColor={IOSColors.label}
                  weight="semibold"
                />
              </GlassView>
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => {
                Haptic.selection();
                toggleSaved(product.id);
              }}
            >
              <GlassView glassEffectStyle="clear" style={styles.heroBtn}>
                <SymbolView
                  name={saved ? 'heart.fill' : 'heart'}
                  size={18}
                  tintColor={saved ? IOSColors.systemRed : IOSColors.label}
                  weight="medium"
                />
              </GlassView>
            </Pressable>
          </View>

          {/* Carousel dots */}
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
            ))}
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.brand}>{product.brand}</Text>
          <Text style={styles.name}>{product.name}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(product.priceWon)}</Text>
          </View>
        </View>

        {/* CTA */}
        <View style={styles.ctaWrap}>
          <Pressable
            style={styles.cta}
            onPress={() => {
              Haptic.medium();
              // TODO: open external store URL
            }}
          >
            <Text style={styles.ctaText}>구매하러 가기</Text>
            <SymbolView
              name="chevron.right"
              size={16}
              tintColor={IOSColors.systemBackground}
              weight="bold"
            />
          </Pressable>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {[
            { id: 'similar', label: '비슷한 것' },
            { id: 'cheaper', label: '더 저렴' },
            { id: 'why', label: '왜 비슷한지' },
          ].map((a) => (
            <Pressable
              key={a.id}
              style={styles.actionBtn}
              onPress={() => {
                Haptic.light();
                if (a.id === 'why') setWhyExpanded((v) => !v);
              }}
            >
              <Text style={styles.actionText}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Why card */}
        {whyExpanded && (
          <View style={styles.whyCard}>
            <Text style={styles.whyText}>
              비슷한 색감 · 오버사이즈 핏 · 코튼 소재 — 무드 시그널이 3개 축에서 일치해.
            </Text>
          </View>
        )}

        {/* Similar products grid (3-col) */}
        <Text style={styles.simHeader}>더 비슷한 것</Text>
        <View style={styles.simGrid}>
          {similar.map((p) => (
            <Pressable
              key={p.id}
              style={styles.simCard}
              onPress={() => {
                Haptic.light();
                router.push(`/product/${p.id}`);
              }}
            >
              <View style={styles.simImageWrap}>
                <View style={[styles.simImage, { backgroundColor: p.colorHint }]} />
                <View style={styles.simPriceTag}>
                  <Text style={styles.simPriceText}>{formatPrice(p.priceWon)}</Text>
                </View>
              </View>
              <Text style={styles.simBrand} numberOfLines={1}>
                {p.brand}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Composer — floats over content so the chips/input show real glass. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.composerFloat}
        pointerEvents="box-none"
      >
        <View style={[styles.composerWrap, { paddingBottom: insets.bottom + 12 }]}>
          {/* Scope chip — locked to this product (replaces filter chip per §3.9) */}
          <View style={styles.chipRow}>
            <View style={styles.scopeChip}>
              <View
                style={[
                  styles.scopeThumb,
                  { backgroundColor: product.colorHint },
                ]}
              />
              <Text style={styles.scopeLabel}>이 제품 기준</Text>
              <Text style={styles.scopeBrand}>· {product.brand}</Text>
            </View>
            {CRITIQUE.map((c) => (
              <Pressable key={c.id} onPress={() => Haptic.light()}>
                <GlassView glassEffectStyle="clear" style={styles.critiqueChip}>
                  <Text style={styles.critiqueText}>{c.label}</Text>
                </GlassView>
              </Pressable>
            ))}
          </View>

          <GlassView glassEffectStyle="clear" style={styles.composer}>
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
            />
            <Pressable
              hitSlop={6}
              disabled={!canSend}
              style={[styles.sendBtn, !canSend && styles.sendBtnDisabled]}
              onPress={() => Haptic.medium()}
            >
              <SymbolView
                name="arrow.right"
                size={18}
                tintColor={IOSColors.systemBackground}
                weight="bold"
              />
            </Pressable>
          </GlassView>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.secondarySystemBackground,
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

  // Info
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

  // CTA
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
  ctaText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },

  // Actions
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 14,
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: IOSColors.systemBackground,
  },
  actionText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  whyCard: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  whyText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  // Similar
  simHeader: {
    ...IOSText.title3,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 12,
  },
  simGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    paddingHorizontal: GRID_PADDING,
  },
  simCard: {
    width: SIM_CARD_W,
  },
  simImageWrap: {
    width: SIM_CARD_W,
    height: SIM_CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  simImage: {
    width: '100%',
    height: '100%',
  },
  simPriceTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  simPriceText: {
    ...IOSText.caption1,
    fontWeight: '700',
    // Sits on a white pill over the photo; stay dark in both modes.
    color: '#1C1C1E',
    fontFamily: IOSFont.rounded,
  },
  simBrand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    marginTop: 6,
    fontFamily: IOSFont.rounded,
  },

  // Composer
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
