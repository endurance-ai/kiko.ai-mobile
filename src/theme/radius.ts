/**
 * Corner radius scale.
 *
 * Follows Apple's continuous corner convention — softer at small sizes, larger
 * radii read as physical roundness. Names are semantic (what it's for) rather
 * than metric (how many pixels) so the values can be tuned without touching
 * every callsite.
 *
 * When to reach for which:
 *  - `pill`   — chips, tag pills, filter buttons (always fully rounded ends)
 *  - `card`   — content cards, sheets, primary CTA buttons
 *  - `field`  — text inputs, small tiles
 *  - `image`  — product thumbnails, avatars (unless circular)
 *  - `sheet`  — bottom sheets, modals (top corners only)
 *  - `hair`   — tightly cropped elements where 2px is enough to soften
 */
export const Radius = {
  none: 0,
  hair: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  /** Fully rounded — use `9999` and clamp to shortest side */
  pill: 9999,
} as const;

/**
 * Semantic aliases — use these in component code so future tuning is one
 * change to the value, not a repo-wide find/replace.
 */
export const RadiusRole = {
  chip: Radius.pill,
  button: Radius.md,
  field: Radius.md,
  image: Radius.lg,
  card: Radius.xl,
  sheet: Radius.xxl,
} as const;
