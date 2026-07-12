/**
 * Brand palette — kiko.ai identity colors.
 *
 * Extracted from `src/app/login.tsx` (peach marquee gradient) as initial
 * values. TODO: verify with design team + expand once brand guidelines
 * document lands.
 *
 * These are **brand** colors — they express Kiko AI's personality (warm,
 * soft, feminine, fashion-forward). For SYSTEM colors (labels, backgrounds,
 * separators) use `IOSColors` from `@/constants/ios` instead, so accessibility
 * and dark mode still adapt automatically.
 */
export const BrandColors = {
  /**
   * Peach scale — currently used as the login marquee gradient
   * (`login.tsx` lines 69-71). Numeric suffix follows the tint→shade convention
   * (50 lightest, 900 darkest).
   */
  peach: {
    50: '#fef3e9',
    100: '#fce4d2',
    200: '#f5cdb6',
    300: '#eebda5',
    400: '#e5a888',
    500: '#dc946b', // TODO: confirm mid tone with design team
    600: '#b57856',
    700: '#8f5d41',
    800: '#68432d',
    900: '#42291a',
  },
} as const;

/**
 * Semantic brand roles — how the palette is used, not what it looks like.
 * Consumers should prefer these over raw scale values so a palette shift
 * doesn't touch every screen.
 */
export const BrandRole = {
  /** Primary brand tint — buttons, badges, active states */
  primary: BrandColors.peach[300],
  /** Softer brand tint — backgrounds, empty states */
  soft: BrandColors.peach[100],
  /** Deep brand tint — brand text on light backgrounds */
  deep: BrandColors.peach[700],
} as const;

/**
 * Login marquee gradient stops. Keep the tuple in one place so any screen
 * needing "the same peach gradient as login" reads from here.
 */
export const BrandGradient = {
  loginMarquee: [
    BrandColors.peach[100],
    BrandColors.peach[200],
    BrandColors.peach[300],
  ] as const,
} as const;
