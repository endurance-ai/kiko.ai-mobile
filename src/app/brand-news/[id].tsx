/**
 * 브랜드 소식 전체 리스트 — 브랜드 홈 "최근 소식 ›" 드릴다운.
 * 데이터: GET /v1/brands/{id}/news (키셋 커서, 최신순, 무인증).
 * 구성: 플로팅 ‹ + 중앙 내비 타이틀 + inset grouped 카드 (brand-news-lab 문법).
 */
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { getBrandNews } from '@/lib/brands';
import { relativeTime } from '@/lib/relative-time';
import { Glass, Haptic, IOSColors, IOSFont, IOSText, Radius } from '@/theme';
import type { BrandNewsItem } from '@/types/api';

const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
const GROUP_CARD_RADIUS = 26;
const TOOLBAR_BTN = 36;

export default function BrandNewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;

  const [items, setItems] = useState<BrandNewsItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!id) return;
    void getBrandNews(id, { limit: 20 })
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setCursor(res.next_cursor);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const loadMore = useCallback(async () => {
    if (!id || !cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getBrandNews(id, { cursor, limit: 20 });
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setCursor(res.next_cursor);
    } catch {
      // fail-open: 더보기 실패는 조용히 (기존 목록 유지)
    } finally {
      setLoadingMore(false);
    }
  }, [id, cursor, loadingMore]);

  const handleBack = () => {
    Haptic.light();
    router.back();
  };

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      <View style={[styles.floatingBar, { top: topInset + Spacing.one }]}>
        <View pointerEvents="none" style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>최근 소식</Text>
        </View>
        <Pressable hitSlop={8} onPress={handleBack} accessibilityRole="button" accessibilityLabel="뒤로가기">
          <GlassSurface {...Glass.chip} isInteractive style={styles.toolbarPill}>
            {Platform.OS === 'web' ? (
              <Text style={styles.backGlyph}>‹</Text>
            ) : (
              <SymbolView name="chevron.left" size={17} tintColor={IOSColors.label} weight="medium" />
            )}
          </GlassSurface>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset + TOOLBAR_BTN + Spacing.four, paddingBottom: insets.bottom + Spacing.six },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {items == null ? (
          <ActivityIndicator style={{ paddingVertical: Spacing.six }} />
        ) : items.length === 0 ? (
          <Text style={styles.empty}>아직 소식이 없어요</Text>
        ) : (
          <View style={styles.groupCard}>
            {items.map((n, i) => (
              <View key={n.id}>
                {i > 0 && <View style={styles.rowSeparator} />}
                <View style={styles.newsRow}>
                  <Text style={styles.newsMessage}>{n.text}</Text>
                  {n.sub ? <Text style={styles.newsSub}>{n.sub}</Text> : null}
                  <Text style={styles.newsTime}>{relativeTime(n.started_at)}</Text>
                </View>
              </View>
            ))}
            {cursor != null && (
              <>
                <View style={styles.rowSeparator} />
                <Pressable
                  style={styles.moreRow}
                  onPress={loadMore}
                  disabled={loadingMore}
                  accessibilityRole="button"
                  accessibilityLabel="더 보기"
                >
                  {loadingMore ? (
                    <ActivityIndicator />
                  ) : (
                    <Text style={styles.moreText}>더 보기</Text>
                  )}
                </Pressable>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: IOSColors.systemGroupedBackground },
  floatingBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navTitleWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  navTitle: { ...IOSText.headline, color: IOSColors.label, fontFamily: IOSFont.sans },
  toolbarPill: {
    width: TOOLBAR_BTN,
    height: TOOLBAR_BTN,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  backGlyph: { fontSize: 22, lineHeight: 22, fontWeight: '500', color: IOSColors.label, fontFamily: IOSFont.sans },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.three },
  groupCard: { backgroundColor: IOSColors.systemBackground, borderRadius: GROUP_CARD_RADIUS, overflow: 'hidden' },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOSColors.separator,
    marginLeft: Spacing.three,
  },
  newsRow: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three },
  newsMessage: { ...IOSText.subhead, color: IOSColors.label, fontFamily: IOSFont.sans },
  newsSub: { ...IOSText.subhead, color: IOSColors.secondaryLabel, fontFamily: IOSFont.sans, marginTop: 1 },
  newsTime: { ...IOSText.footnote, color: IOSColors.tertiaryLabel, fontFamily: IOSFont.sans, marginTop: Spacing.half },
  moreRow: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.three, alignItems: 'center' },
  moreText: { ...IOSText.subhead, color: IOSColors.systemBlue, fontFamily: IOSFont.sans, fontWeight: '600' },
  empty: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    paddingVertical: Spacing.six,
  },
});
