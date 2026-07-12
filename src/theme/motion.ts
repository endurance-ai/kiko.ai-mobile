/**
 * Motion tokens — spring configs for Reanimated 4 / react-native-worklets.
 *
 * Grounded in Apple's "Designing Fluid Interfaces" (WWDC 2018): every
 * gesture-adjacent animation is a spring, so it stays interruptible and
 * velocity-aware. Never reach for `Animated.timing` for anything a user can
 * touch — `withSpring(target, config)` is the default.
 *
 * The two designer-facing knobs mirror Apple's model:
 *  - `dampingRatio` (0..1) — overshoot. 1.0 = critical damping (no bounce).
 *  - `duration` (ms)       — settle time. NOT a fixed play length.
 *
 * See docs/design-system.md and .claude/skills/apple-design/SKILL.md for the
 * "why" behind each preset.
 */

import type { WithSpringConfig } from 'react-native-reanimated';

/**
 * Move / reposition — critically damped, medium settle. Default for any UI
 * element sliding into place (list rows, cards, floating buttons).
 * Apple ships damping 1.0 / response 0.4.
 */
export const springMove: WithSpringConfig = {
  dampingRatio: 1.0,
  duration: 400,
};

/**
 * Rotation — allow a hint of overshoot (a pointer that snaps into position
 * physically overshoots and settles). Apple: damping 0.8 / response 0.4.
 */
export const springRotation: WithSpringConfig = {
  dampingRatio: 0.8,
  duration: 400,
};

/**
 * Drawer / sheet — snappier + a touch of overshoot to communicate momentum.
 * Use for any surface the user can flick or drag (bottom sheets, side drawers,
 * dismiss gestures). Apple: damping 0.8 / response 0.3.
 */
export const springDrawer: WithSpringConfig = {
  dampingRatio: 0.8,
  duration: 300,
};

/**
 * Snappy — for micro-interactions that must feel immediate (chip select,
 * pill press-in). Critically damped so there's no bounce on tap.
 */
export const springSnappy: WithSpringConfig = {
  dampingRatio: 1.0,
  duration: 200,
};

/**
 * Gentle — for atmospheric moves that shouldn't demand attention
 * (background parallax, header collapse). Critically damped, longer settle.
 */
export const springGentle: WithSpringConfig = {
  dampingRatio: 1.0,
  duration: 600,
};

/**
 * Bouncy — reserved for celebrations / positive feedback (success confetti,
 * favorite heart pop). Do NOT use for functional UI — bounce on a menu that
 * just faded in feels wrong.
 */
export const springBouncy: WithSpringConfig = {
  dampingRatio: 0.6,
  duration: 500,
};

export const Motion = {
  move: springMove,
  rotation: springRotation,
  drawer: springDrawer,
  snappy: springSnappy,
  gentle: springGentle,
  bouncy: springBouncy,
} as const;

/**
 * Fixed durations for the rare cases where a spring isn't appropriate:
 * non-gesture entries/exits (toast fade, tooltip). Prefer springs elsewhere.
 * All values in ms. Match Apple's HIG timing recommendations.
 */
export const Duration = {
  /** Instant response — button press feedback, hover state */
  instant: 100,
  /** Fast — chip select, small state changes */
  fast: 200,
  /** Base — most transitions, page/sheet entries */
  base: 300,
  /** Slow — heavy content transitions, cross-fades between screens */
  slow: 500,
  /** Ambient — parallax, backdrop shifts */
  ambient: 800,
} as const;

/**
 * Easing curves for `withTiming`. Only when a spring is wrong (fixed-length
 * animation, one-shot exits). Values encoded as cubic-bezier control points
 * so both Reanimated (via `Easing.bezierFn`) and CSS can share them.
 */
export const Easing = {
  /** Default — accelerate then decelerate (in-out). Neutral. */
  standard: [0.4, 0.0, 0.2, 1.0] as const,
  /** Entering — decelerate into place. Use for elements appearing. */
  enter: [0.0, 0.0, 0.2, 1.0] as const,
  /** Exiting — accelerate away. Use for elements dismissing. */
  exit: [0.4, 0.0, 1.0, 1.0] as const,
  /** Linear — only for continuous progress (spinners, loading bars). */
  linear: [0.0, 0.0, 1.0, 1.0] as const,
} as const;
