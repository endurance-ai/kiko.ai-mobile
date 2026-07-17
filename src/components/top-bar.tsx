import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/theme';

type Props = {
  onOpenMenu?: () => void;
  /** 스크롤을 충분히 내렸을 때만 헤더에 노출되는 '큐레이션'(최상단 복귀) 버튼. */
  showCuration?: boolean;
  onOpenCuration?: () => void;
  onOpenList?: () => void;
  onOpenWishlist?: () => void;
};

export function TopBar({
  onOpenMenu,
  showCuration,
  onOpenCuration,
  onOpenList,
  onOpenWishlist,
}: Props) {
  const tap = (cb?: () => void) => () => {
    Haptic.light();
    cb?.();
  };

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.row}>
        <Pressable hitSlop={6} onPress={tap(onOpenMenu)}>
          <GlassSurface variant="pill" isInteractive style={styles.iconPill}>
            <SymbolView
              name="line.3.horizontal"
              size={20}
              tintColor={IOSColors.label}
              weight="medium"
            />
          </GlassSurface>
        </Pressable>

        <View style={styles.rightGroup}>
          {/* 큐레이션 — 스크롤 95% 이상 내렸을 때만 헤더에 페이드로 등장,
              탭하면 최상단(발견 구좌) 복귀. 최상단으로 올라가면 사라진다. */}
          {showCuration && (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)}>
              <Pressable hitSlop={6} onPress={tap(onOpenCuration)}>
                <GlassSurface variant="pill" isInteractive style={styles.textPill}>
                  <SymbolView
                    name="sparkles"
                    size={16}
                    tintColor={IOSColors.label}
                    weight="medium"
                  />
                  <Text style={styles.pillText}>큐레이션</Text>
                </GlassSurface>
              </Pressable>
            </Animated.View>
          )}

          <Pressable hitSlop={6} onPress={tap(onOpenList)}>
            <GlassSurface variant="pill" isInteractive style={styles.textPill}>
              <SymbolView
                name="list.bullet"
                size={16}
                tintColor={IOSColors.label}
                weight="medium"
              />
              <Text style={styles.pillText}>히스토리</Text>
            </GlassSurface>
          </Pressable>

          <Pressable hitSlop={6} onPress={tap(onOpenWishlist)}>
            <GlassSurface variant="pill" isInteractive style={styles.textPill}>
              <SymbolView
                name="heart"
                size={16}
                tintColor={IOSColors.label}
                weight="medium"
              />
              <Text style={styles.pillText}>찜</Text>
            </GlassSurface>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const PILL_HEIGHT = 40;

const styles = StyleSheet.create({
  safe: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  rightGroup: { flexDirection: 'row', gap: 8 },
  iconPill: {
    width: PILL_HEIGHT,
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
    fontFamily: IOSFont.sans,
  },
});
