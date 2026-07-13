import {
  GlassView,
  isLiquidGlassAvailable,
  type GlassColorScheme,
  type GlassStyle,
} from 'expo-glass-effect';
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';

import { IOSColors } from '@/theme';

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
  /** Override the glass appearance (default 'auto' follows system theme). */
  colorScheme?: GlassColorScheme;
  /**
   * Whether the pre-iOS26 fallback should draw its hairline border + shadow.
   * Default true (matches the header/composer bars where the border reads as
   * elevation). Set to false for surfaces that should float over a colored
   * background — e.g. the login marquee, where the border shows through as
   * a gray outline against the gradient.
   */
  bordered?: boolean;
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
  colorScheme,
  bordered = true,
  style,
  children,
  ...rest
}: Props) {
  if (isLiquidGlassAvailable()) {
    // When bordered=false the caller wants a minimal chip that lets a
    // colored background show through — force the see-through glass style
    // unless the caller supplied an explicit override.
    const effectiveGlassStyle = bordered ? glassStyle : 'clear';
    return (
      <GlassView
        glassEffectStyle={effectiveGlassStyle}
        tintColor={tintColor}
        isInteractive={isInteractive}
        colorScheme={colorScheme}
        style={style}
        {...rest}
      >
        {children}
      </GlassView>
    );
  }
  const base = variant === 'composer' ? fallbackStyles.composer : fallbackStyles.pill;
  const edge = bordered
    ? variant === 'composer'
      ? fallbackStyles.composerEdge
      : fallbackStyles.pillEdge
    : fallbackStyles.bareEdge;
  return (
    <View style={[style, base, edge]} {...rest}>
      {children}
    </View>
  );
}

const fallbackStyles = StyleSheet.create({
  pill: {
    backgroundColor: IOSColors.systemBackground,
  },
  pillEdge: {
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
  },
  composerEdge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 3,
  },
  // No border + no shadow + no background — for surfaces that float over a
  // colored background (e.g. login marquee) where the base pill/composer
  // white fill would otherwise show as a gray/off-white box against the
  // gradient. Caller is responsible for setting an explicit background when
  // one is desired (e.g. a subtle rgba white).
  bareEdge: {
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: 'transparent',
  },
});
