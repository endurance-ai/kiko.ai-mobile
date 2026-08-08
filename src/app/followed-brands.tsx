/**
 * 팔로우 브랜드 관리 — 설정 > 알림 > '팔로우 브랜드 관리'.
 *
 * GET /v1/me/follows. 행: 브랜드명(탭 → 브랜드 홈) + 알림 스위치(notify on/off).
 * 알림 토글 = POST /v1/brands/{id}/follow {notify} (팔로우 유지, 스펙 통합).
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
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { followBrand, listFollows } from '@/lib/brands';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/theme';
import type { FollowItem } from '@/types/api';

const PAGE_SIZE = 30;
const SWITCH_TRACK_COLOR = { false: IOSColors.systemGray4, true: IOSColors.systemGreen };

export default function FollowedBrandsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<FollowItem[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listFollows({ limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setCursor(res.next_cursor);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await listFollows({ cursor, limit: PAGE_SIZE });
      setItems((prev) => [...(prev ?? []), ...res.items]);
      setCursor(res.next_cursor);
    } catch {
      // ignore
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore]);

  const toggleNotify = (brandId: number, next: boolean) => {
    Haptic.light();
    setItems((prev) =>
      (prev ?? []).map((it) =>
        it.brand_id === brandId ? { ...it, notify_enabled: next } : it,
      ),
    );
    void followBrand(brandId, next).catch(() => {
      // 롤백
      setItems((prev) =>
        (prev ?? []).map((it) =>
          it.brand_id === brandId ? { ...it, notify_enabled: !next } : it,
        ),
      );
    });
  };

  const renderRow = ({ item, index }: { item: FollowItem; index: number }) => (
    <View>
      {index > 0 && <View style={styles.rowSeparator} />}
      <View style={styles.row}>
        <Pressable
          style={styles.rowLabel}
          onPress={() =>
            router.push(
              `/brand/${item.brand_id}?brand_name=${encodeURIComponent(item.brand_name)}` as never,
            )
          }
          accessibilityRole="button"
          accessibilityLabel={`${item.brand_name} 브랜드 홈`}
        >
          <Text style={styles.brandName} numberOfLines={1}>
            {item.brand_name}
          </Text>
          {Platform.OS === 'web' ? (
            <Text style={styles.chevron}>›</Text>
          ) : (
            <SymbolView name="chevron.right" size={13} tintColor={IOSColors.tertiaryLabel} weight="semibold" />
          )}
        </Pressable>
        <Switch
          value={item.notify_enabled}
          onValueChange={(v) => toggleNotify(item.brand_id, v)}
          trackColor={SWITCH_TRACK_COLOR}
          accessibilityLabel={`${item.brand_name} 알림`}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.root}>
      {items === null ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>팔로우한 브랜드가 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it.brand_id)}
          renderItem={renderRow}
          contentContainerStyle={{
            paddingTop: insets.top + FLOATING_HEADER_OFFSET,
            paddingBottom: insets.bottom + 32,
            paddingHorizontal: 20,
          }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ paddingVertical: 24 }} /> : null
          }
        />
      )}
      <FloatingHeader title="팔로우 브랜드" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOSColors.separator,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  rowLabel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandName: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    flexShrink: 1,
  },
  chevron: {
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '600',
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },
});
