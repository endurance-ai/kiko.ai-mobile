import { SymbolView } from 'expo-symbols';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { GlassSurface } from '@/components/glass-surface';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/theme';
import { useBanner } from '@/state/banner';

const FADE_MS = 220;

/**
 * Banner that floats above the composer. Shows at most one — highest
 * priority wins (error > billing > notice). When the active banner sets
 * `autoDismissMs`, the component runs the timer + fade-out itself; sticky
 * banners stay until the caller clears them.
 *
 * Surface: Apple Liquid Glass (forced dark scheme so white copy stays
 * readable on top), with a dark solid fallback on older OSes.
 */
export function Banner() {
  const { active, clear } = useBanner();
  const opacity = useRef(new Animated.Value(0)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!active) return;
    // Fade in.
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (active.autoDismissMs && active.autoDismissMs > 0) {
      const id = active.id;
      const fadeStartIn = Math.max(0, active.autoDismissMs - FADE_MS);
      // Trigger fade-out near the end of the window.
      fadeTimer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: FADE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }, fadeStartIn);
      dismissTimer.current = setTimeout(() => clear(id), active.autoDismissMs);
    }

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      dismissTimer.current = null;
      fadeTimer.current = null;
    };
  }, [active, clear, opacity]);

  if (!active) return null;

  const handleAction = () => {
    if (!active.action) return;
    Haptic.light();
    active.action.onPress();
  };

  // billing (캡 소진) 과 error (요청 처리 실패) 는 solid 검정 배경으로 강한
  // 어텐션을 준다. notice 만 clear glass 로 컨텐츠 위에 얹힌 느낌 유지.
  const isSolidDark =
    active.priority === 'billing' || active.priority === 'error';
  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      {isSolidDark ? (
        <View style={[styles.card, styles.billingCard]}>
          <View style={styles.textCol}>
            <Text style={[styles.title, styles.billingText]} numberOfLines={2}>
              {active.title}
            </Text>
            {active.subtitle && (
              <Text
                style={[styles.subtitle, styles.billingSubtitle]}
                numberOfLines={2}
              >
                {active.subtitle}
              </Text>
            )}
          </View>

          {active.action && (
            <Pressable onPress={handleAction} style={styles.billingActionBtn}>
              <Text style={styles.billingActionLabel}>
                {active.action.label}
              </Text>
              <SymbolView
                name="arrow.right"
                size={12}
                tintColor={IOSColors.label}
                weight="semibold"
              />
            </Pressable>
          )}
        </View>
      ) : (
        <GlassSurface
          variant="composer"
          glassStyle="clear"
          style={styles.card}
        >
          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={2}>
              {active.title}
            </Text>
            {active.subtitle && (
              <Text style={styles.subtitle} numberOfLines={2}>
                {active.subtitle}
              </Text>
            )}
          </View>

          {active.action && (
            <Pressable onPress={handleAction} style={styles.actionBtn}>
              <Text style={styles.actionLabel}>{active.action.label}</Text>
              <SymbolView
                name="arrow.right"
                size={12}
                tintColor={IOSColors.systemBackground}
                weight="semibold"
              />
            </Pressable>
          )}
        </GlassSurface>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    overflow: 'hidden',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...IOSText.body,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  subtitle: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.sans,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: IOSColors.label,
  },
  actionLabel: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
  // Billing (캡 소진) 전용 — 검정 배경 + 흰 텍스트.
  billingCard: {
    backgroundColor: '#0A0A0A',
  },
  billingText: {
    color: '#FFFFFF',
  },
  billingSubtitle: {
    color: 'rgba(255,255,255,0.72)',
  },
  billingActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  billingActionLabel: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: '#0A0A0A',
    fontFamily: IOSFont.sans,
  },
});
