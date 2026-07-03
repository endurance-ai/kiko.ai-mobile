import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { formatPrice, type Product } from '@/state/products';

const CARD_WIDTH = 156;
const CARD_HEIGHT = 196;

type Props = {
  product: Product;
  pinned?: boolean;
  onPress?: () => void;
  onPin?: () => void;
};

export function ProductCard({ product, pinned = false, onPress, onPin }: Props) {
  const handlePress = () => {
    Haptic.light();
    onPress?.();
  };
  const handlePin = () => {
    Haptic.selection();
    onPin?.();
  };

  return (
    <View style={styles.root}>
      <Pressable style={styles.imageWrap} onPress={handlePress}>
        {product.imageUri ? (
          <Image
            source={{ uri: product.imageUri }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.image, { backgroundColor: product.colorHint }]} />
        )}

        {/* Pin (+) — top right. Sits on a white pill over the photo, so the
            icon must stay dark regardless of system color scheme. */}
        <Pressable hitSlop={8} style={styles.pinBtn} onPress={handlePin}>
          <SymbolView
            name={pinned ? 'checkmark' : 'plus'}
            size={14}
            tintColor="#1C1C1E"
            weight="bold"
          />
        </Pressable>

        {/* Price tag — bottom left */}
        <View style={styles.priceTag}>
          <Text style={styles.priceText}>{formatPrice(product.priceWon)}</Text>
        </View>
      </Pressable>

      <Text style={styles.brand} numberOfLines={1}>
        {product.brand}
      </Text>
      <Text style={styles.name} numberOfLines={1}>
        {product.name}
      </Text>
    </View>
  );
}

export const PRODUCT_CARD_WIDTH = CARD_WIDTH;

const styles = StyleSheet.create({
  root: {
    width: CARD_WIDTH,
  },
  imageWrap: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  pinBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceTag: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  priceText: {
    ...IOSText.footnote,
    fontWeight: '700',
    // Always dark — sits on a white tag pinned over the photo.
    color: '#1C1C1E',
    fontFamily: IOSFont.sans,
  },
  brand: {
    ...IOSText.subhead,
    fontWeight: '700',
    color: IOSColors.label,
    marginTop: 10,
    fontFamily: IOSFont.sans,
  },
  name: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.sans,
  },
});
