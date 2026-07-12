/**
 * Single-entry design system.
 *
 * Import EVERYTHING design-related from `@/theme`:
 *
 *   import { Motion, Radius, Elevation, Glass, IOSColors, IOSText } from '@/theme';
 *
 * Never import raw values directly from constants or Motion primitives.
 * See docs/design-system.md for the natural-language → token map.
 */

// New token layers (introduced with the design system foundation)
export { Motion, Duration, Easing, springMove, springRotation, springDrawer, springSnappy, springGentle, springBouncy } from './motion';
export { Radius, RadiusRole } from './radius';
export { Elevation } from './elevation';
export { Opacity, Scrim } from './opacity';
export { BrandColors, BrandRole, BrandGradient } from './brand';
export { Glass } from './glass';

// Re-export existing constants so consumers only touch one path.
// Keep `@/constants/*` importable for backward-compat, but new code
// should use `@/theme`.
export { IOSColors, IOSFont, IOSText, Haptic } from '@/constants/ios';
export { Colors, Fonts, Spacing, BottomTabInset, MaxContentWidth } from '@/constants/theme';
export type { ThemeColor } from '@/constants/theme';
