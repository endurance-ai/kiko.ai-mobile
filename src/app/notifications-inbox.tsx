/**
 * 알림 — 개인 소식함 (뉴스와 분리된 개인 아카이브).
 *
 * 역할: 찜 세일·재입고 + 팔로우 브랜드 소식의 유저별 아카이브 = "놓친 푸시의
 * 영수증". 행 탭 → PDP/브랜드 홈. 뉴스(데일리 브리핑 방송 채널)와 혼류하지
 * 않음 — 브리핑은 모두 동일, 여긴 나만의 것.
 *
 * 데이터: GET /v1/notifications (keyset cursor + unread_count). 진입 시 전체
 * 읽음 처리(PATCH /read {all}) — 헤더 벨 빨간 점이 여기 진입으로 꺼진다.
 *
 * IA: 동급 표면 (사이드바 [알림], 빨간 점은 여기에만) → ☰.
 * 기준: .claude/skills/apple-hig → docs/apple-blueprints.md → design-system.md
 */
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { listNotifications, markNotificationsRead } from '@/lib/notifications';
import { Glass, Haptic, IOSColors, IOSFont, IOSText, Radius } from '@/theme';
import type { NotificationItem } from '@/types/api';

const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
const TOOLBAR_BTN = 36;
const LIST_ROW_HEIGHT = 52; // iOS 27 리스트 행 실측
const PAGE_SIZE = 30;

const won = (n: number): string => `${n.toLocaleString('ko-KR')}원`;

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const min = Math.floor((Date.now() - t) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day === 1) return '어제';
  if (day < 7) return `${day}일 전`;
  return `${Math.floor(day / 7)}주 전`;
}

export default function NotificationsInboxScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;
  const { width: windowWidth } = useWindowDimensions();

  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listNotifications({ limit: PAGE_SIZE });
        if (cancelled) return;
        setItems(res.items);
        setCursor(res.next_cursor);
        // 진입 = 전체 읽음(헤더 벨 빨간 점 해제). 행의 read 표시는 이미 받은
        // 값 그대로 두어 "이번에 새로 온 것"이 눈에 남게 한다. best-effort.
        if (res.unread_count > 0) void markNotificationsRead({ all: true }).catch(() => {});
      } catch {
        if (!cancelled) setItems([]); // 401/네트워크 — 빈 상태
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await listNotifications({ cursor, limit: PAGE_SIZE });
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setCursor(res.next_cursor);
    } catch {
      // ignore — 다음 스크롤에서 재시도
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const handleOpenSidebar = () => {
    Haptic.light();
    router.push('/sidebar');
  };

  const handleRowPress = (n: NotificationItem) => {
    Haptic.selection();
    if (n.product_id != null) router.push(`/product/${n.product_id}` as never);
    else if (n.brand_id != null) router.push(`/brand/${n.brand_id}` as never);
  };

  const renderRow = ({ item: n, index }: { item: NotificationItem; index: number }) => (
    <View>
      {index > 0 && <View style={styles.rowSeparator} />}
      <Pressable
        accessibilityRole="button"
        onPress={() => handleRowPress(n)}
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        {/* 미확인 점 — 행 좌측 (iOS 메일 관례) */}
        <View style={[styles.unreadDot, n.read && styles.unreadDotHidden]} />
        <View style={styles.rowBody}>
          <Text style={[styles.rowText, n.read && styles.rowTextRead]}>{n.text}</Text>
          {n.old_price != null && n.new_price != null && (
            <Text style={styles.rowPrice}>
              <Text style={styles.rowPriceOld}>{won(n.old_price)}</Text>
              {'  '}
              {won(n.new_price)}
            </Text>
          )}
          {n.sub.length > 0 && <Text style={styles.rowPrice}>{n.sub}</Text>}
          <Text style={styles.rowTime}>{relativeTime(n.created_at)}</Text>
        </View>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      <View style={[styles.floatingBar, { top: topInset + Spacing.one }]}>
        <View pointerEvents="none" style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>알림</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={handleOpenSidebar}
          accessibilityRole="button"
          accessibilityLabel="메뉴"
        >
          <GlassSurface {...Glass.chip} isInteractive style={styles.toolbarPill}>
            {Platform.OS === 'web' ? (
              <Text style={styles.menuGlyph}>☰</Text>
            ) : (
              <SymbolView name="line.3.horizontal" size={18} tintColor={IOSColors.label} weight="medium" />
            )}
          </GlassSurface>
        </Pressable>
      </View>

      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>아직 받은 소식이 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={renderRow}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: topInset + TOOLBAR_BTN + Spacing.four,
              paddingBottom: insets.bottom + Spacing.six,
            },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ paddingVertical: Spacing.four }} /> : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: IOSColors.systemBackground,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  floatingBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  navTitle: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  toolbarPill: {
    width: TOOLBAR_BTN,
    height: TOOLBAR_BTN,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  menuGlyph: {
    fontSize: 17,
    lineHeight: 18,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOSColors.separator,
  },
  row: {
    minHeight: LIST_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  rowPressed: {
    backgroundColor: IOSColors.systemGray5,
  },
  // iOS 메일 미확인 점 — 8px systemBlue.
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemBlue,
  },
  unreadDotHidden: {
    opacity: 0,
  },
  rowBody: {
    flex: 1,
  },
  rowText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  rowTextRead: {
    fontWeight: '400',
    color: IOSColors.secondaryLabel,
  },
  rowPrice: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginTop: 1,
  },
  rowPriceOld: {
    color: IOSColors.tertiaryLabel,
    textDecorationLine: 'line-through',
  },
  rowTime: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: 1,
  },
});
