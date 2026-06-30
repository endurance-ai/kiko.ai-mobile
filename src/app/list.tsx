import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
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

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { GlassSurface } from '@/components/glass-surface';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { buildFilterLabel, useFilter } from '@/state/filter';
import { formatPrice, MOCK_PRODUCTS, type Product } from '@/state/products';

// Mock list sets — backend will eventually return these from
// `last_query` + cross-turn impression history (Redis chat_state).
const CURRENT_LIST = {
  title: '크림톤 오버셔츠',
  count: 24,
  products: Array.from({ length: 24 }, (_, i) => ({
    ...MOCK_PRODUCTS[i % MOCK_PRODUCTS.length],
    id: `cur-${i}`,
  })) satisfies Product[],
};

const PAST_LISTS: { title: string; meta: string; products: Product[] }[] = [
  {
    title: '와이드 데님 · 빈티지',
    meta: '18개 · 어제',
    products: Array.from({ length: 6 }, (_, i) => ({
      ...MOCK_PRODUCTS[(i + 3) % MOCK_PRODUCTS.length],
      id: `past1-${i}`,
    })),
  },
  {
    title: '크롭 자켓 · 봄 무드',
    meta: '12개 · 3일 전',
    products: Array.from({ length: 6 }, (_, i) => ({
      ...MOCK_PRODUCTS[(i + 6) % MOCK_PRODUCTS.length],
      id: `past2-${i}`,
    })),
  },
  {
    title: '실크 블라우스 · 미니멀',
    meta: '9개 · 1주일 전',
    products: Array.from({ length: 6 }, (_, i) => ({
      ...MOCK_PRODUCTS[(i + 1) % MOCK_PRODUCTS.length],
      id: `past3-${i}`,
    })),
  },
];

const CRITIQUE = [
  { id: 'sim', label: '더 비슷하게' },
  { id: 'cheap', label: '더 저렴하게' },
];

// 3-column grid math (user override: 2 cols in spec → 3 cols)
const SCREEN_W = Dimensions.get('window').width;
const GRID_PADDING = 20;
const GRID_GAP = 10;
const CARD_W = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

export default function ListScreen() {
  const insets = useSafeAreaInsets();
  const { value: filter } = useFilter();
  const [text, setText] = useState('');

  const canSend = text.trim().length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          {
            paddingTop: insets.top + FLOATING_HEADER_OFFSET,
            paddingBottom: insets.bottom + 180,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Current list */}
        <Text style={styles.sectionLabel}>현재 보는 리스트</Text>
        <View style={styles.currentTitleRow}>
          <View style={styles.dot} />
          <Text style={styles.currentTitle}>{CURRENT_LIST.title}</Text>
          <Text style={styles.currentCount}> · {CURRENT_LIST.count}</Text>
        </View>
        <Grid products={CURRENT_LIST.products} />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>이전 리스트</Text>
          <View style={styles.dividerLine} />
        </View>

        {PAST_LISTS.map((pl, idx) => (
          <View key={pl.title} style={{ marginTop: idx === 0 ? 0 : 28 }}>
            <Text style={styles.pastTitle}>{pl.title}</Text>
            <Text style={styles.pastMeta}>{pl.meta}</Text>
            <Grid products={pl.products} />
          </View>
        ))}
      </ScrollView>

      {/* Composer — floats over content so the chips/input show real glass. */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.composerFloat}
        pointerEvents="box-none"
      >
        <View style={[styles.composerWrap, { paddingBottom: insets.bottom + 12 }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
          >
            <Pressable
              onPress={() => {
                Haptic.light();
                router.push('/filter');
              }}
            >
              <GlassSurface variant="pill" isInteractive style={styles.filterChip}>
                <Text style={styles.filterChipText}>{buildFilterLabel(filter)}</Text>
                <SymbolView
                  name="chevron.up"
                  size={11}
                  tintColor={IOSColors.secondaryLabel}
                  weight="semibold"
                />
              </GlassSurface>
            </Pressable>
            {CRITIQUE.map((c) => (
              <Pressable key={c.id} onPress={() => Haptic.light()}>
                <GlassSurface variant="pill" isInteractive style={styles.critiqueChip}>
                  <Text style={styles.critiqueChipText}>{c.label}</Text>
                </GlassSurface>
              </Pressable>
            ))}
          </ScrollView>

          <GlassSurface variant="composer" style={styles.composer}>
            <Pressable hitSlop={6} style={styles.composerIcon} onPress={() => Haptic.light()}>
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
              placeholder="이 리스트에서 더 밝은 걸로..."
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
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>

      <FloatingHeader title="리스트" />
    </View>
  );
}

function Grid({ products }: { products: Product[] }) {
  return (
    <View style={styles.grid}>
      {products.map((p) => (
        <GridCard key={p.id} product={p} />
      ))}
    </View>
  );
}

function GridCard({ product }: { product: Product }) {
  return (
    <Pressable
      style={styles.card}
      onPress={() => {
        Haptic.light();
        router.push(`/product/${product.id}`);
      }}
    >
      <View style={styles.cardImageWrap}>
        <View style={[styles.cardImage, { backgroundColor: product.colorHint }]} />
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{formatPrice(product.priceWon)}</Text>
        </View>
      </View>
      <Text style={styles.cardBrand} numberOfLines={1}>
        {product.brand}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.secondarySystemBackground,
  },

  // Body
  body: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 16,
    paddingBottom: 24,
  },
  sectionLabel: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
    marginBottom: 4,
  },
  currentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: IOSColors.label,
    marginRight: 8,
  },
  currentTitle: {
    ...IOSText.title2,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  currentCount: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  card: {
    width: CARD_W,
  },
  cardImageWrap: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  priceTag: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  priceText: {
    ...IOSText.caption1,
    fontWeight: '700',
    // Sits on a white pill over the photo; stay dark in both modes.
    color: '#1C1C1E',
    fontFamily: IOSFont.rounded,
  },
  cardBrand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    marginTop: 6,
    fontFamily: IOSFont.rounded,
  },

  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 36,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOSColors.separator,
  },
  dividerText: {
    ...IOSText.caption1,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.rounded,
  },
  pastTitle: {
    ...IOSText.title3,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  pastMeta: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    marginTop: 2,
    marginBottom: 12,
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
    paddingHorizontal: 4,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  filterChipText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  critiqueChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  critiqueChipText: {
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
