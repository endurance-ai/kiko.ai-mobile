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

// iOS system tokens + haptics — the only remaining `@/constants/*`
// re-export after Phase 2 dead-code removal. Everything design-related
// flows through `@/theme` for consumers.
export { IOSColors, IOSFont, IOSText, Haptic } from '@/constants/ios';
