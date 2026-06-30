import {
  GlassView,
  isLiquidGlassAvailable,
  type GlassStyle,
} from 'expo-glass-effect';
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { IOSColors } from '@/constants/ios';

type Variant = 'pill' | 'composer';

type Props = ViewProps & {
  /**
   * Visual role — drives shadow depth + fallback border weight.
   * - `pill`: small chips, header buttons (subtle elevation).
   * - `composer`: floating input bars (heavier elevation).
   */
  variant?: Variant;
  /**
   * Glass style on iOS 26+. Defaults to 'regular' (the readable variant);
   * use 'clear' only when the design needs maximum see-through.
   */
  glassStyle?: GlassStyle;
  /** Forwarded to GlassView when liquid glass is active. */
  tintColor?: string;
  /** Forwarded to GlassView; gives a subtle press response. */
  isInteractive?: boolean;
  children?: ReactNode;
};

/**
 * Unified surface for chips / composer / header pills.
 *
 * On iOS 26+ it renders Apple's real Liquid Glass material (vibrancy +
 * auto contrast against backdrop). On older OSes / Android it falls back
 * to a themed solid pill with hairline border + soft shadow — same shape,
 * readable everywhere.
 *
 * Children render unchanged; they should keep using IOSColors.label and
 * other system tokens so vibrancy / theme adaption both work.
 */
export function GlassSurface({
  variant = 'pill',
  glassStyle = 'regular',
  tintColor,
  isInteractive,
  style,
  children,
  ...rest
}: Props) {
  if (isLiquidGlassAvailable()) {
    return (
      <GlassView
        glassEffectStyle={glassStyle}
        tintColor={tintColor}
        isInteractive={isInteractive}
        style={style}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  const fallback =
    variant === 'composer' ? fallbackStyles.composer : fallbackStyles.pill;
  return (
    <View style={[style, fallback]} {...rest}>
      {children}
    </View>
  );
}

const fallbackStyles = StyleSheet.create({
  pill: {
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  composer: {
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
});
