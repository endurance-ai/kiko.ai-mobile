/**
 * Liquid Glass surface tokens.
 *
 * Kiko AI's core visual language is Apple's Liquid Glass (iOS 26+). Every
 * translucent surface should go through `GlassSurface` (`@/components/glass-surface`)
 * which auto-selects real liquid glass on iOS 26 and a themed fallback pill
 * with hairline border + soft shadow elsewhere.
 *
 * These tokens describe the *intent* of a glass surface — pick the level
 * that matches how much backdrop the surface should reveal, then pass
 * `glassStyle` and `variant` to `GlassSurface`.
 */

import type { GlassStyle } from 'expo-glass-effect';

type GlassLevel = {
  /** Passed to `GlassSurface.glassStyle` (iOS 26+ Liquid Glass) */
  glassStyle: GlassStyle;
  /** Passed to `GlassSurface.variant` (drives pre-iOS26 fallback shadow) */
  variant: 'pill' | 'composer';
  /** Whether the pre-iOS 26 fallback should render border + shadow */
  bordered: boolean;
  /** When to reach for this level */
  usage: string;
};

/**
 * Chips, filter pills, header buttons — small surfaces sitting on scrollable
 * content. Subtle depth on old OS via hairline border + soft shadow.
 */
export const chip: GlassLevel = {
  glassStyle: 'regular',
  variant: 'pill',
  bordered: true,
  usage: 'chips, filter pills, header buttons, dismiss badges',
};

/**
 * Composer bars, floating inputs, sticky action bars — surfaces that must
 * separate from the content behind them.
 */
export const composer: GlassLevel = {
  glassStyle: 'regular',
  variant: 'composer',
  bordered: true,
  usage: 'composer bars, floating inputs, sticky bottom action bars',
};

/**
 * Bare pill floating over a colored background (e.g. login marquee gradient).
 * Skips the fallback border/shadow so the underlying color shows through.
 */
export const bareOnColor: GlassLevel = {
  glassStyle: 'clear',
  variant: 'pill',
  bordered: false,
  usage: 'pills over gradients / images where a solid fill would look boxy',
};

/**
 * Maximum see-through — for surfaces where the priority is showing what's
 * behind (spotlight overlays, image caption tags).
 */
export const clear: GlassLevel = {
  glassStyle: 'clear',
  variant: 'pill',
  bordered: false,
  usage: 'transparent captions on media, spotlight badges',
};

export const Glass = {
  chip,
  composer,
  bareOnColor,
  clear,
} as const;
