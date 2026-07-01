import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  FLOATING_HEADER_OFFSET,
  FloatingHeader,
} from "@/components/floating-header";
import { Haptic, IOSColors, IOSFont, IOSText } from "@/constants/ios";
import { ApiError } from "@/lib/api";
import { listHistory } from "@/lib/history";
import { useBanner } from "@/state/banner";
import type { HistoryItem, HistoryResultSetItem } from "@/types/api";

const SCREEN_W = Dimensions.get("window").width;
const COLS = 3;
const GRID_GAP = 6;
const SIDE_PAD = 0;
const TILE_W = (SCREEN_W - SIDE_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ session?: string }>();
  const rawSession = params.session as string | undefined;
  // Empty / placeholder session id → treat as "no history yet". Server
  // requires a UUID, so hitting /v1/history with a placeholder returns 422.
  const sessionId =
    rawSession && rawSession !== "mock-session" ? rawSession : null;

  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { show: showBanner } = useBanner();

  const load = useCallback(async () => {
    if (!sessionId) {
      setItems([]);
      return;
    }
    try {
      const res = await listHistory(sessionId, { limit: 50 });
      setItems(res.items);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        // Session doesn't exist / no longer accessible — show empty state.
        setItems([]);
        return;
      }
      setItems([]);
      showBanner({
        id: "history-load-failed",
        priority: "error",
        title: "히스토리를 불러오지 못했어요",
        action: { label: "다시 시도", onPress: () => void load() },
      });
    }
  }, [sessionId, showBanner]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onTileTap = useCallback(
    (item: HistoryItem) => {
      Haptic.light();
      if (item.type === "result_set") {
        router.push(
          `/list?session=${sessionId}&search=${item.search_id}` as never,
        );
      } else {
        router.push(
          `/product/${item.product_id}?session=${sessionId}&source=${item.source_search_id ?? ""}` as never,
        );
      }
    },
    [sessionId],
  );

  const isLoading = items === null;
  const isEmpty = items !== null && items.length === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          {
            paddingTop: insets.top + FLOATING_HEADER_OFFSET,
            paddingBottom: insets.bottom + 24,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#999"
          />
        }
      >
        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        )}

        {isEmpty && (
          <View style={styles.center}>
            <Text style={styles.muted}>아직 히스토리가 없어요</Text>
            <Text style={styles.mutedSmall}>
              홈에서 새로운 채팅을 시작해보세요
            </Text>
          </View>
        )}

        {!isLoading && !isEmpty && (
          <View style={styles.grid}>
            {items!.map((item, idx) => (
              <Tile
                key={tileKey(item, idx)}
                item={item}
                onPress={() => onTileTap(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingHeader title="히스토리" />
    </View>
  );
}

function tileKey(item: HistoryItem, idx: number): string {
  return item.type === "result_set"
    ? `rs-${item.search_id}`
    : `pv-${item.product_id}-${idx}`;
}

function Tile({ item, onPress }: { item: HistoryItem; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.tile}
      android_ripple={{ color: "rgba(0,0,0,0.06)" }}
    >
      {item.type === "result_set" ? (
        <BundleTile item={item} />
      ) : (
        <Image source={{ uri: item.image_url }} style={styles.fillImage} />
      )}
    </Pressable>
  );
}

function BundleTile({ item }: { item: HistoryResultSetItem }) {
  const imgs = item.preview_images.slice(0, 4);
  const n = imgs.length;

  if (n <= 1) {
    return (
      <>
        <Image source={{ uri: imgs[0] }} style={styles.fillImage} />
        <CountBadge count={item.result_count} />
      </>
    );
  }

  // 2x2 mini grid for 2-4 previews, badge top-right with total count.
  return (
    <>
      <View style={styles.mini2x2}>
        {[0, 1, 2, 3].map((i) => {
          const uri = imgs[i % n];
          return (
            <View key={i} style={styles.miniCell}>
              <Image source={{ uri }} style={styles.fillImage} />
            </View>
          );
        })}
      </View>
      <CountBadge count={item.result_count} />
    </>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <View style={styles.countBadge}>
      <Text style={styles.countText}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  body: {
    paddingHorizontal: SIDE_PAD,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  tile: {
    width: TILE_W,
    height: TILE_W,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: IOSColors.tertiarySystemBackground,
    position: "relative",
  },
  fillImage: {
    width: "100%",
    height: "100%",
  },
  mini2x2: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: "100%",
    height: "100%",
  },
  miniCell: {
    width: "50%",
    height: "50%",
    padding: 1,
  },
  countBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    minWidth: 28,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  countText: {
    ...IOSText.caption1,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: IOSFont.rounded,
  },
  center: {
    paddingVertical: 80,
    alignItems: "center",
    gap: 8,
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  mutedSmall: {
    ...IOSText.caption1,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.rounded,
  },
});
