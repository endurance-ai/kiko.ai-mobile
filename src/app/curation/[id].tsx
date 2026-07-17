/**
 * 큐레이션 구좌 전용 그리드 페이지 — 홈 큐레이션 구좌의 '더보기' 목적지.
 *
 * 홈은 구좌당 카드 5개만 가로로 보여주고, 더보기를 누르면 이 화면에서 해당
 * 구좌의 전체 상품(서버가 준 최대 20개)을 검색 결과 리스트(/list)와 동일한
 * 엣지투엣지 3열 이미지 그리드 + 하단 컴포저로 편다. 데이터는 useCuration
 * 훅 재사용 — 홈에서 채운 AsyncStorage 캐시가 있어 즉시 뜬다.
 *
 * 컴포저는 /list 와 동일: 타일 체크로 상품을 앵커(pin)하고, 텍스트를 보내면
 * seed + pin_* 를 홈으로 넘겨 검색을 이어간다(홈이 게스트 로그인 게이트 처리).
 * 찜(하트)은 비로그인 시 로그인 시트로 게이트.
 */
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
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
import { trackProductImpression } from '@/lib/analytics';
import { useAuth } from '@/state/auth';
import { useCap } from '@/state/cap';
import { useCuration } from '@/state/curation';
import { buildFilterLabel, useFilter } from '@/state/filter';
import type { OnboardingGender } from '@/state/onboarding';
import { formatPrice } from '@/state/products';
import { useWishlist } from '@/state/wishlist';
import {
  Haptic,
  IOSColors,
  IOSFont,
  IOSText,
  Opacity,
  Radius,
  withAlpha,
} from '@/theme';
import type { CurationProduct } from '@/types/api';

// 3-col edge-to-edge (mirrors /list · PDP similar grid).
const CARD_W = Dimensions.get('window').width / 3;

// 홈 컴포저와 동일한 크리틱 칩.
const CRITIQUE_CHIPS = [
  { id: 'similar', label: '더 비슷하게' },
  { id: 'cheaper', label: '더 저렴하게' },
];

function GridTile({
  product,
  position,
  pinned,
  onTogglePin,
}: {
  product: CurationProduct;
  position: number;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { isSaved, toggle } = useWishlist();
  const { status: authStatus } = useAuth();
  const pidStr = String(product.product_id);
  const saved = isSaved(pidStr);

  useEffect(() => {
    trackProductImpression({
      productId: pidStr,
      brand: product.brand,
      searchId: null,
      position,
      source: 'curation-more',
    });
  }, [pidStr, product.brand, position]);

  const openPdp = () => {
    Haptic.light();
    router.push(`/product/${product.product_id}` as never);
  };
  const onSave = () => {
    Haptic.selection();
    if (authStatus !== 'authenticated') {
      router.push('/login');
      return;
    }
    void toggle(pidStr);
  };

  return (
    <Pressable style={styles.card} onPress={openPdp}>
      <View style={styles.thumb}>
        {product.image_url ? (
          <Image source={product.image_url} style={styles.fill} contentFit="cover" />
        ) : (
          <View style={[styles.fill, styles.thumbFallback]} />
        )}
        {/* 우상단 액션 — [체크(anchor pin), 찜]. /list · 홈과 통일. */}
        <View style={styles.cardActions}>
          <Pressable
            hitSlop={8}
            style={[styles.checkBtn, pinned && styles.checkBtnOn]}
            onPress={onTogglePin}
          >
            <SymbolView
              name="checkmark"
              size={11}
              tintColor={pinned ? IOSColors.systemBackground : withAlpha('#FFFFFF', Opacity.softened)}
              weight="bold"
            />
          </Pressable>
          <Pressable
            hitSlop={8}
            style={[styles.heartBtn, saved && styles.heartBtnOn]}
            onPress={onSave}
          >
            <SymbolView
              name={saved ? 'heart.fill' : 'heart'}
              size={12}
              tintColor={saved ? IOSColors.systemBackground : withAlpha('#FFFFFF', Opacity.nearFull)}
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
            {formatPrice(Math.round(product.price))}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

export default function CurationSectionScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string; gender?: string; title?: string }>();
  const sectionId = params.id;
  const gender: OnboardingGender | null =
    params.gender === 'women' || params.gender === 'men' ? params.gender : null;
  const title = params.title ?? '큐레이션';

  const { sections } = useCuration(gender);
  const { status: authStatus } = useAuth();
  const { locked: capLocked } = useCap();
  const { value: filter } = useFilter();
  const [text, setText] = useState('');
  const [pinnedProductId, setPinnedProductId] = useState<string | null>(null);

  const products = useMemo(
    () => sections?.find((s) => s.id === sectionId)?.products ?? [],
    [sections, sectionId],
  );
  const pinnedProduct = pinnedProductId
    ? products.find((p) => String(p.product_id) === pinnedProductId) ?? null
    : null;
  const canSend = !capLocked && text.trim().length > 0;

  const togglePinnedProduct = (productId: string) => {
    if (capLocked) return;
    Haptic.selection();
    setPinnedProductId((prev) => (prev === productId ? null : productId));
  };

  // seed(+ 앵커 상품 pin_*)를 홈으로 넘겨 검색을 이어간다. 비로그인은 홈이
  // 게스트 게이트로 로그인 시트를 띄운다. 컴포저 전송·크리틱 칩 공용.
  const sendSeed = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed || capLocked) return;
    Haptic.medium();
    // 비로그인은 홈으로 넘겨 검색을 돌리는 대신 여기서 바로 로그인 시트.
    // (홈 경유하면 메인이 깜빡였다 로그인이 뜨는 문제 — PDP kickoffChat 과 동일)
    if (authStatus !== 'authenticated') {
      router.push('/login');
      return;
    }
    const qs: string[] = [`seed=${encodeURIComponent(trimmed)}`];
    if (pinnedProduct) {
      qs.push(`pin_id=${encodeURIComponent(String(pinnedProduct.product_id))}`);
      qs.push(`pin_label=${encodeURIComponent(pinnedProduct.brand || '선택한 상품')}`);
      if (pinnedProduct.image_url)
        qs.push(`pin_image=${encodeURIComponent(pinnedProduct.image_url)}`);
      if (pinnedProduct.price != null)
        qs.push(`pin_price=${encodeURIComponent(String(Math.round(pinnedProduct.price)))}`);
    }
    router.push(`/home?${qs.join('&')}` as never);
  };
  const handleSend = () => {
    if (!canSend) return;
    const t = text.trim();
    setText('');
    sendSeed(t);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          {
            paddingTop: insets.top + FLOATING_HEADER_OFFSET,
            // 하단 float 컴포저에 마지막 행이 안 가려지게 여유.
            paddingBottom: insets.bottom + 110,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {products.length > 0 ? (
          <View style={styles.grid}>
            {products.map((p, idx) => {
              const pidStr = String(p.product_id);
              return (
                <GridTile
                  key={p.product_id}
                  product={p}
                  position={idx}
                  pinned={pinnedProductId === pidStr}
                  onTogglePin={() => togglePinnedProduct(pidStr)}
                />
              );
            })}
          </View>
        ) : (
          <View style={styles.center}>
            <Text style={styles.muted}>상품을 불러오는 중이에요…</Text>
          </View>
        )}
      </ScrollView>

      <FloatingHeader title={title} onBack={() => router.back()} />

      {/* Composer — /list 와 동일한 하단 float. 이 구좌를 보면서 이어서 검색. */}
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
                  <Image source={pinnedProduct.image_url} style={styles.pinThumb} contentFit="cover" />
                ) : (
                  <View style={[styles.pinThumb, styles.thumbFallback]} />
                )}
                <Text style={styles.pinLabel} numberOfLines={1}>
                  {pinnedProduct.brand || '선택한 상품'}
                </Text>
                <Pressable hitSlop={6} onPress={() => setPinnedProductId(null)}>
                  <SymbolView name="xmark.circle.fill" size={18} tintColor={IOSColors.tertiaryLabel} />
                </Pressable>
              </View>
            </View>
          )}
          {/* 공용 필터 버튼 + 크리틱 칩 — 홈 컴포저와 동일. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable onPress={() => { Haptic.light(); router.push('/filter'); }}>
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
            {CRITIQUE_CHIPS.map((c) => (
              <Pressable key={c.id} disabled={capLocked} onPress={() => sendSeed(c.label)}>
                <GlassSurface variant="pill" isInteractive style={styles.critiqueChip}>
                  <Text style={styles.critiqueChipText}>{c.label}</Text>
                </GlassSurface>
              </Pressable>
            ))}
          </ScrollView>

          <GlassSurface variant="composer" style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={capLocked ? '오늘 사용량이 다 소진됐어요' : '이미지/링크를 추가하거나 요청…'}
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
              <SymbolView name="arrow.up" size={18} tintColor={IOSColors.systemBackground} weight="bold" />
            </Pressable>
          </GlassSurface>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  body: { paddingHorizontal: 0 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 16,
  },
  card: { width: CARD_W },
  thumb: {
    width: '100%',
    aspectRatio: 0.82,
    overflow: 'hidden',
    backgroundColor: IOSColors.tertiarySystemBackground,
    marginBottom: 2,
    position: 'relative',
  },
  fill: { width: '100%', height: '100%' },
  thumbFallback: { backgroundColor: IOSColors.tertiarySystemBackground },
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
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: withAlpha('#FFFFFF', Opacity.nearFull),
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
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: withAlpha('#FFFFFF', Opacity.nearFull),
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
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
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
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  filterChipText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  critiqueChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  critiqueChipText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
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
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  pinThumb: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
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
    borderRadius: Radius.xxl,
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
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: IOSColors.systemGray3,
  },
});
