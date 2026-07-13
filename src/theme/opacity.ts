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

/**
 * `#RRGGBB` hex 색상을 alpha 를 적용한 `rgba(r,g,b,a)` 문자열로 변환.
 *
 * IOSColors 는 `PlatformColor` 기반이라 문자열이 아니므로 이 헬퍼로 감쌀 수
 * 없다. 순수 흰/검·픽셀 이펙트처럼 다크모드 대응 없이 강제로 하드코딩된 색상
 * 위에 반투명이 필요할 때만 사용. Semantic 상 opacity 값은 `Opacity` /
 * `Scrim` 토큰에서 골라 넘기는 게 원칙 (직접 숫자 지양).
 */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
