/**
 * Opacity / alpha scale.
 *
 * Used for disabled states, overlays, dim backdrops, and any place a
 * semi-transparent tone is called for. Named by *intent* — pick the name
 * that matches what the surface is trying to communicate, not the numeric
 * value.
 */
export const Opacity = {
  /** Fully hidden — animate to/from */
  none: 0,
  /** Ghosted — placeholder text, disabled labels */
  faint: 0.35,
  /** Muted — secondary content sitting behind an active element */
  muted: 0.5,
  /** Softened — inactive but still readable */
  softened: 0.7,
  /** Nearly full — subtle depth without desaturating */
  nearFull: 0.9,
  /** Fully opaque */
  full: 1,
} as const;

/**
 * Backdrop / scrim overlays behind sheets and modals.
 * Use with a black or system-background fill.
 */
export const Scrim = {
  /** Barely-there — non-blocking hint (e.g. spotlight on target) */
  hint: 0.15,
  /** Standard — behind bottom sheets, popovers */
  standard: 0.35,
  /** Heavy — full-screen modal blocking content */
  heavy: 0.55,
} as const;
