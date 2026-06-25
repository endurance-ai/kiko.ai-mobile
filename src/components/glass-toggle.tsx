import { GlassView } from 'expo-glass-effect';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Haptic, IOSColors } from '@/constants/ios';

type Props = {
  value: boolean;
  onValueChange: (v: boolean) => void;
  /** Disable interaction; toggle stays in its current state. */
  disabled?: boolean;
};

const TRACK_W = 52;
const TRACK_H = 32;
const THUMB = 26;
const PADDING = 3;

export function GlassToggle({ value, onValueChange, disabled }: Props) {
  const x = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(x, {
      toValue: value ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [value, x]);

  const tx = x.interpolate({
    inputRange: [0, 1],
    outputRange: [PADDING, TRACK_W - THUMB - PADDING],
  });

  const handle = () => {
    if (disabled) return;
    Haptic.selection();
    onValueChange(!value);
  };

  return (
    <Pressable
      onPress={handle}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      hitSlop={6}
      style={[styles.wrap, disabled && styles.wrapDisabled]}
    >
      <GlassView glassEffectStyle="clear" style={styles.track}>
        {/* Translucent tint over the glass — keeps the frosted look on
            flat solid cards (where pure glass would render as opaque). */}
        <View style={[styles.tint, value ? styles.tintOn : styles.tintOff]} />
        <Animated.View
          style={[styles.thumb, { transform: [{ translateX: tx }] }]}
        />
      </GlassView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  wrapDisabled: {
    opacity: 0.4,
  },
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    justifyContent: 'center',
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
  },
  tintOff: {
    // systemFill 은 다크모드에서도 인식 가능한 회색 frost.
    backgroundColor: IOSColors.systemFill,
  },
  tintOn: {
    backgroundColor: IOSColors.label,
  },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
});
