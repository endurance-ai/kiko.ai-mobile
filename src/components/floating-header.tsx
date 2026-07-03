import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';

type Props = {
  title?: string;
  onBack?: () => void;
  backLabel?: string;
  rightSlot?: ReactNode;
};

const PILL = 40;

// Approximate header height (status bar inset added by SafeAreaView).
// Screens use this as `paddingTop` so first content row clears the floating bar.
export const FLOATING_HEADER_OFFSET = 52;

export function FloatingHeader({ title, onBack, backLabel, rightSlot }: Props) {
  return (
    <View style={styles.float} pointerEvents="box-none">
      <SafeAreaView edges={['top']} style={styles.safe}>
        <View style={styles.row}>
          <Pressable
            hitSlop={8}
            onPress={() => {
              Haptic.light();
              if (onBack) onBack();
              else router.back();
            }}
          >
            <GlassSurface
              variant="pill"
              isInteractive
              style={[styles.pill, backLabel ? styles.pillLabeled : null]}
            >
              <SymbolView
                name="chevron.left"
                size={18}
                tintColor={IOSColors.label}
                weight="semibold"
              />
              {backLabel ? (
                <Text style={styles.backLabel}>{backLabel}</Text>
              ) : null}
            </GlassSurface>
          </Pressable>

          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            <View style={styles.titleSpacer} />
          )}

          <View style={styles.right}>{rightSlot ?? <View style={styles.spacer} />}</View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  float: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
  },
  safe: {
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingTop: 4,
  },
  pill: {
    minWidth: PILL,
    height: PILL,
    borderRadius: PILL / 2,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillLabeled: {
    paddingLeft: 8,
    paddingRight: 14,
    gap: 2,
  },
  backLabel: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  title: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    flex: 1,
    textAlign: 'center',
  },
  titleSpacer: {
    flex: 1,
  },
  right: {
    width: PILL,
    alignItems: 'flex-end',
  },
  spacer: {
    width: PILL,
    height: PILL,
  },
});
