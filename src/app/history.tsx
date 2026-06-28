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
import type { HistoryItem, HistoryResultSetItem } from "@/types/api";

// Mock feed — mirrors /v1/history?session_id=X response shape exactly so the
// real fetch is a drop-in swap once the backend PR lands (feat/results-history-api).
const MOCK_FEED: HistoryItem[] = [
  {
    type: "result_set",
    occurred_at: "2026-06-28T05:12:00+00:00",
    search_id: "rs-001",
    query_text: "크림톤 오버셔츠",
    result_count: 24,
    preview_images: [
      "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400",
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400",
      "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400",
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400",
    ],
  },
  {
    type: "product",
    occurred_at: "2026-06-28T05:08:00+00:00",
    product_id: 9001,
    brand: "noon",
    name: "크림 오버셔츠",
    price: 48000,
    image_url:
      "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=600",
    product_url: null,
    source_search_id: "rs-001",
  },
  {
    type: "result_set",
    occurred_at: "2026-06-27T18:40:00+00:00",
    search_id: "rs-002",
    query_text: "와이드 데님 빈티지",
    result_count: 8,
    preview_images: [
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=400",
      "https://images.unsplash.com/photo-1604176354204-9268737828e4?w=400",
      "https://images.unsplash.com/photo-1582418702059-97ebafb35d09?w=400",
    ],
  },
  {
    type: "result_set",
    occurred_at: "2026-06-27T17:20:00+00:00",
    search_id: "rs-003",
    query_text: "크롭 자켓 봄 무드",
    result_count: 14,
    preview_images: [
      "https://images.unsplash.com/photo-1591047139756-eed1a0d20a0a?w=400",
      "https://images.unsplash.com/photo-1620799139501-9d3a3d7d6b56?w=400",
      "https://images.unsplash.com/photo-1611601679395-3c5e0d72d8e6?w=400",
      "https://images.unsplash.com/photo-1612722432474-b971cdcea546?w=400",
    ],
  },
  {
    type: "product",
    occurred_at: "2026-06-27T16:00:00+00:00",
    product_id: 9002,
    brand: "depound",
    name: "베이지 셔츠",
    price: 39000,
    image_url:
      "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=600",
    product_url: null,
    source_search_id: "rs-001",
  },
  {
    type: "result_set",
    occurred_at: "2026-06-26T22:10:00+00:00",
    search_id: "rs-004",
    query_text: "실크 블라우스",
    result_count: 16,
    preview_images: [
      "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=400",
      "https://images.unsplash.com/photo-1485518882345-15568b007407?w=400",
      "https://images.unsplash.com/photo-1571513722275-4b41940f54b8?w=400",
      "https://images.unsplash.com/photo-1564257631407-3deb25e91c92?w=400",
    ],
  },
  {
    type: "product",
    occurred_at: "2026-06-26T20:30:00+00:00",
    product_id: 9003,
    brand: "another",
    name: "와이드 데님",
    price: 59000,
    image_url:
      "https://images.unsplash.com/photo-1542272604-787c3835535d?w=600",
    product_url: null,
    source_search_id: "rs-002",
  },
  {
    type: "result_set",
    occurred_at: "2026-06-25T11:00:00+00:00",
    search_id: "rs-005",
    query_text: "루즈핏 카디건",
    result_count: 6,
    preview_images: [
      "https://images.unsplash.com/photo-1620799140188-3b2a02fd9a77?w=400",
      "https://images.unsplash.com/photo-1610288311735-39b7facbd095?w=400",
    ],
  },
];

const SCREEN_W = Dimensions.get("window").width;
const COLS = 3;
const GRID_GAP = 6;
const SIDE_PAD = 0;
const TILE_W = (SCREEN_W - SIDE_PAD * 2 - GRID_GAP * (COLS - 1)) / COLS;

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ session?: string }>();
  const sessionId = (params.session as string) || "mock-session";

  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    // Real wire-up (deferred until backend deploy):
    //   const res = await listHistory(sessionId);
    //   setItems(res.items);
    await new Promise((r) => setTimeout(r, 250));
    setItems(MOCK_FEED);
  }, []);

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
