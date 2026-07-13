import { Image } from "expo-image";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import {
  ActivityIndicator,
  Dimensions,
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
import { Haptic, IOSColors, IOSFont, IOSText , Radius } from "@/theme";
import { useAuth } from "@/state/auth";
import { useWishlist } from "@/state/wishlist";
import type { SaveListItem } from "@/types/api";

const SCREEN_W = Dimensions.get("window").width;
const GRID_PADDING = 20;
const GRID_GAP = 10;
const CARD_W = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

function formatPrice(price: number | null): string {
  if (price === null || Number.isNaN(price)) return "";
  return `₩${Math.round(price).toLocaleString("ko-KR")}`;
}

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const { items, status, error, toggle, refresh } = useWishlist();
  const { status: authStatus } = useAuth();
  const isGuest = authStatus !== "authenticated";

  // 게스트: 저장이 불가하므로 로딩/에러 대신 항상 빈 상태로 취급.
  const isLoading = !isGuest && status === "loading" && items.length === 0;
  const isError = !isGuest && status === "error" && items.length === 0;
  const isEmpty =
    isGuest || (status === "ready" && items.length === 0);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + FLOATING_HEADER_OFFSET },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={status === "loading" && items.length > 0}
            onRefresh={() => void refresh()}
            tintColor="#999"
          />
        }
      >
        <Text style={styles.metaText}>{items.length}개 저장됨</Text>

        {isLoading && (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        )}

        {isError && (
          <View style={styles.center}>
            <Text style={styles.muted}>{error}</Text>
            <Pressable onPress={() => void refresh()} style={styles.retry}>
              <Text style={styles.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        )}

        {isEmpty && (
          <View style={styles.emptyBlock}>
            <Text style={styles.emptyText}>저장할수록 더 똑똑해져요</Text>
          </View>
        )}

        {items.length > 0 && (
          <View style={styles.grid}>
            {items.map((it) => (
              <WishCard
                key={it.save_id}
                item={it}
                onUnsave={() => {
                  const pid = it.product?.id?.toString();
                  if (pid) void toggle(pid);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingHeader title="찜" />
    </View>
  );
}

function WishCard({
  item,
  onUnsave,
}: {
  item: SaveListItem;
  onUnsave: () => void;
}) {
  const product = item.product;
  const pid = product?.id?.toString();
  const stale = product === null;

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cardImageWrap}
        onPress={() => {
          if (!pid) return;
          Haptic.light();
          router.push(`/product/${pid}` as never);
        }}
      >
        {product?.image_url ? (
          <Image
            source={product.image_url}
            style={styles.cardImage}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.cardImage,
              { backgroundColor: IOSColors.tertiarySystemBackground },
            ]}
          />
        )}
        <Pressable
          hitSlop={8}
          style={styles.heartBtn}
          onPress={() => {
            Haptic.selection();
            onUnsave();
          }}
        >
          <SymbolView
            name="heart.fill"
            size={12}
            // 다크모드에선 버튼 bg (IOSColors.label) 이 흰색이라 흰 하트가
            // 안 보이던 문제 → systemBackground 로 두면 항상 bg 반대색.
            tintColor={IOSColors.systemBackground}
            weight="bold"
          />
        </Pressable>
        {product?.price != null && (
          <View style={styles.priceTag}>
            <Text style={styles.priceText}>{formatPrice(product.price)}</Text>
          </View>
        )}
      </Pressable>
      <Text style={styles.brand} numberOfLines={1}>
        {stale ? "판매 종료" : (product?.brand ?? "")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },

  body: {
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
    paddingBottom: 32,
  },
  metaText: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginBottom: 16,
    fontFamily: IOSFont.sans,
  },

  center: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  retry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  retryText: {
    ...IOSText.callout,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },

  emptyBlock: {
    alignItems: "center",
    paddingVertical: 80,
    gap: 14,
  },
  emptyText: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },

  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GRID_GAP,
  },
  card: { width: CARD_W },
  cardImageWrap: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: Radius.lg,
    overflow: "hidden",
    position: "relative",
  },
  cardImage: { width: "100%", height: "100%" },
  heartBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.95)",
    backgroundColor: IOSColors.label,
    justifyContent: "center",
    alignItems: "center",
  },
  priceTag: {
    position: "absolute",
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: Radius.sm,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  priceText: {
    ...IOSText.caption1,
    fontWeight: "700",
    color: "#1C1C1E",
    fontFamily: IOSFont.sans,
  },
  brand: {
    ...IOSText.footnote,
    fontWeight: "600",
    color: IOSColors.label,
    marginTop: 6,
    fontFamily: IOSFont.sans,
  },
});
