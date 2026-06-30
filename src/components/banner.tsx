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
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
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

  return (
    <Animated.View style={[styles.wrap, { opacity }]}>
      <GlassSurface
        variant="composer"
        glassStyle="regular"
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
    fontFamily: IOSFont.rounded,
  },
  subtitle: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.rounded,
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
    fontFamily: IOSFont.rounded,
  },
});
