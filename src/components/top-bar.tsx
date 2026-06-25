import { GlassView } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';

type Props = {
  onOpenMenu?: () => void;
  onOpenList?: () => void;
  onOpenWishlist?: () => void;
};

export function TopBar({ onOpenMenu, onOpenList, onOpenWishlist }: Props) {
  const tap = (cb?: () => void) => () => {
    Haptic.light();
    cb?.();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        {/* Left: hamburger / sidebar */}
        <Pressable hitSlop={6} onPress={tap(onOpenMenu)}>
          <GlassView glassEffectStyle="clear" style={styles.iconPill}>
            <SymbolView
              name="line.3.horizontal"
              size={20}
              tintColor={IOSColors.label}
              weight="medium"
            />
          </GlassView>
        </Pressable>

        {/* Right group */}
        <View style={styles.rightGroup}>
          <Pressable hitSlop={6} onPress={tap(onOpenList)}>
            <GlassView glassEffectStyle="clear" style={styles.textPill}>
              <SymbolView
                name="list.bullet"
                size={16}
                tintColor={IOSColors.label}
                weight="medium"
              />
              <Text style={styles.pillText}>리스트</Text>
            </GlassView>
          </Pressable>

          <Pressable hitSlop={6} onPress={tap(onOpenWishlist)}>
            <GlassView glassEffectStyle="clear" style={styles.textPill}>
              <SymbolView
                name="heart"
                size={16}
                tintColor={IOSColors.label}
                weight="medium"
              />
              <Text style={styles.pillText}>찜</Text>
            </GlassView>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const PILL_HEIGHT = 40;

const styles = StyleSheet.create({
  safe: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  rightGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  iconPill: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: PILL_HEIGHT,
    paddingHorizontal: 14,
    borderRadius: PILL_HEIGHT / 2,
    overflow: 'hidden',
  },
  pillText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
});
