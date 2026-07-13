import { StyleSheet, View } from 'react-native';

import { IOSColors } from '@/theme';

// 12-band stacked gradient that fakes an alpha fade above the composer.
// Sit it as the first child inside `composerWrap` (which has the solid
// `secondarySystemBackground` floor) and pass an optional `bands` count.
// expo-linear-gradient is not installed so we keep this hand-rolled.

type Props = {
  height?: number;
  bands?: number;
};

export function ComposerFade({ height = 36, bands = 12 }: Props) {
  const bandHeight = height / bands;
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: -height, height }]}
    >
      {Array.from({ length: bands }).map((_, i) => (
        <View
          key={i}
          style={{
            height: bandHeight,
            backgroundColor: IOSColors.secondarySystemBackground,
            opacity: i / (bands - 1),
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
