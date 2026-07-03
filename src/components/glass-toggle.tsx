import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';

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

// iOS 26+ 에선 GlassView 자체가 Liquid Glass 라, on 상태를 tintColor 로
// 유리에 직접 입혀서 오버레이가 유리를 가리지 않게 한다.
const LIQUID = isLiquidGlassAvailable();

export function GlassToggle({ value, onValueChange, disabled }: Props) {
  const scheme = useColorScheme();
  // clear glass 위에 얹는 on-tint. 라이트모드는 반투명 검정, 다크모드는
  // 반투명 흰색으로 뒤집어 배경과 뭉치지 않게 한다.
  const onTint =
    scheme === 'dark' ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.18)';
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
      <GlassView
        glassEffectStyle="clear"
        tintColor={LIQUID && value ? onTint : undefined}
        isInteractive
        style={styles.track}
      >
        {/* 폴백(iOS 25 이하 / Android)에선 유리가 없으니 tint overlay 로 켜짐 표시 */}
        {!LIQUID && (
          <View style={[styles.tint, value ? styles.tintOn : styles.tintOff]} />
        )}
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
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  tintOff: {
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
