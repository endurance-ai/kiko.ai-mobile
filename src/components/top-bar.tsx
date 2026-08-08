import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { Haptic, IOSColors, IOSFont, IOSText, Radius } from '@/theme';

type Props = {
  onOpenMenu?: () => void;
  /** 스크롤을 충분히 내렸을 때만 헤더에 노출되는 '큐레이션'(최상단 복귀) 버튼. */
  showCuration?: boolean;
  onOpenCuration?: () => void;
  /** 알림함(개인 소식함) 열기 — 히스토리 필을 대체(2026-08). 최근 대화는
   *  사이드바 '최근 항목'이 전담하므로 헤더는 알림 + 찜만 노출한다. */
  onOpenNotifications?: () => void;
  /** 읽지 않은 알림 있음 — 벨의 빨간 점 노출. 알림함 진입 시 서버가 전체 읽음
   *  처리하므로, 홈 포커스마다 unread_count 를 다시 읽어 이 값을 갱신한다. */
  hasUnread?: boolean;
  onOpenWishlist?: () => void;
};

export function TopBar({
  onOpenMenu,
  showCuration,
  onOpenCuration,
  onOpenNotifications,
  hasUnread,
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

          {/* 알림 — 벨 아이콘 필 + 빨간 점(읽지 않은 소식). 뱃지 점이 헤더에
              상시 보여야 알림함으로 유입된다. 점은 Pressable 기준으로 얹어
              글래스 필의 overflow 클리핑을 피한다. */}
          <Pressable
            hitSlop={6}
            onPress={tap(onOpenNotifications)}
            accessibilityRole="button"
            accessibilityLabel="알림, 읽지 않은 소식 있음"
          >
            <GlassSurface variant="pill" isInteractive style={styles.iconPill}>
              <SymbolView
                name="bell"
                size={18}
                tintColor={IOSColors.label}
                weight="medium"
              />
            </GlassSurface>
            {hasUnread && <View style={styles.bellDot} pointerEvents="none" />}
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
  // iOS 표준 unread dot — 8pt 빨간 점. 색 하나에 의존하지 않도록(HIG Color)
  // 접근성 라벨("읽지 않은 소식 있음")로 의미를 별도 전달한다.
  bellDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemRed,
  },
});
