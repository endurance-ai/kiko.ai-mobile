import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { formatPrice, type Product } from '@/state/products';
import { useWishlist } from '@/state/wishlist';

const SCREEN_W = Dimensions.get('window').width;
const GRID_PADDING = 20;
const GRID_GAP = 10;
const CARD_W = (SCREEN_W - GRID_PADDING * 2 - GRID_GAP * 2) / 3;

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const { items, toggle } = useWishlist();

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + FLOATING_HEADER_OFFSET },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.metaText}>{items.length}개 저장됨</Text>

        {items.length === 0 ? (
          <View style={styles.emptyBlock}>
            <SymbolView
              name="heart"
              size={36}
              tintColor={IOSColors.tertiaryLabel}
              weight="regular"
            />
            <Text style={styles.emptyText}>
              마음에 드는 제품의 ♥ 를 눌러서 저장해봐
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((p) => (
              <WishCard key={p.id} product={p} onUnsave={() => toggle(p.id)} />
            ))}
          </View>
        )}
      </ScrollView>

      <FloatingHeader title="찜" />
    </View>
  );
}

function WishCard({
  product,
  onUnsave,
}: {
  product: Product;
  onUnsave: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cardImageWrap}
        onPress={() => {
          Haptic.light();
          router.push(`/product/${product.id}`);
        }}
      >
        <View style={[styles.cardImage, { backgroundColor: product.colorHint }]} />
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
            size={14}
            tintColor={IOSColors.systemRed}
            weight="medium"
          />
        </Pressable>
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{formatPrice(product.priceWon)}</Text>
        </View>
      </Pressable>
      <Text style={styles.brand} numberOfLines={1}>
        {product.brand}
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
    fontFamily: IOSFont.rounded,
  },

  emptyBlock: {
    alignItems: 'center',
    paddingVertical: 80,
    gap: 14,
  },
  emptyText: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  card: { width: CARD_W },
  cardImageWrap: {
    width: CARD_W,
    height: CARD_W,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: { width: '100%', height: '100%' },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
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
  brand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    marginTop: 6,
    fontFamily: IOSFont.rounded,
  },
});
