import * as Haptics from 'expo-haptics';
import { Platform, PlatformColor } from 'react-native';

// ── iOS system color tokens ────────────────────────────────────────────────
// PlatformColor pulls UIColor.label / .systemBlue etc. — they adapt to dark
// mode + accessibility (high contrast / increased transparency) for free.
// Use the `withFallback` helper anywhere we need a literal string at module
// load time (e.g. plain backgroundColor for non-iOS dev or web preview).

const ios = Platform.OS === 'ios';
const palette = <K extends string>(token: string, fallback: string) =>
  ios ? (PlatformColor(token) as unknown as string) : fallback;

export const IOSColors = {
  // Foreground text
  label: palette('label', '#1C1C1E'),
  secondaryLabel: palette('secondaryLabel', '#60646C'),
  tertiaryLabel: palette('tertiaryLabel', '#A8A8AE'),
  quaternaryLabel: palette('quaternaryLabel', '#C7C7CC'),
  placeholderText: palette('placeholderText', '#A8A8AE'),

  // Backgrounds
  systemBackground: palette('systemBackground', '#FFFFFF'),
  secondarySystemBackground: palette('secondarySystemBackground', '#F5F5F7'),
  tertiarySystemBackground: palette('tertiarySystemBackground', '#EEEEF1'),
  systemGroupedBackground: palette('systemGroupedBackground', '#F5F5F7'),

  // Grouped fills
  systemFill: palette('systemFill', 'rgba(120,120,128,0.20)'),
  secondarySystemFill: palette('secondarySystemFill', 'rgba(120,120,128,0.16)'),
  tertiarySystemFill: palette('tertiarySystemFill', 'rgba(118,118,128,0.12)'),

  // Standard system colors (HIG accents)
  systemBlue: palette('systemBlue', '#007AFF'),
  systemGreen: palette('systemGreen', '#34C759'),
  systemRed: palette('systemRed', '#FF3B30'),
  systemGray: palette('systemGray', '#8E8E93'),
  systemGray2: palette('systemGray2', '#AEAEB2'),
  systemGray3: palette('systemGray3', '#C7C7CC'),
  systemGray4: palette('systemGray4', '#D1D1D6'),
  systemGray5: palette('systemGray5', '#E5E5EA'),
  systemGray6: palette('systemGray6', '#F2F2F7'),

  separator: palette('separator', 'rgba(60,60,67,0.29)'),
  opaqueSeparator: palette('opaqueSeparator', '#C6C6C8'),
} as const;

// ── iOS system fonts ───────────────────────────────────────────────────────
// SF Pro / SF Pro Rounded / SF Mono via system tokens — dynamic type aware.
export const IOSFont = Platform.select({
  ios: {
    sans: 'system-ui',
    rounded: 'ui-rounded',
    serif: 'ui-serif',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'System',
    rounded: 'System',
    serif: 'serif',
    mono: 'monospace',
  },
})!;

// ── Haptics ────────────────────────────────────────────────────────────────
// Single-source helpers. Calls are fire-and-forget; we never await.
export const Haptic = {
  /** Light tap — chip selection, toggle, picker scroll past a tick */
  selection: () => {
    Haptics.selectionAsync();
  },
  /** Soft impact — secondary button press (filter chip / accessory icons) */
  light: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  /** Medium impact — primary action press (Apply, Send) */
  medium: () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  /** Success notification — search returned cards, image saved */
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  /** Warning — guarded retry, partial result */
  warning: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  /** Error — permission denied, network fail */
  error: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};

// ── Typography presets ─────────────────────────────────────────────────────
// HIG text style sizes (iOS 17). Use these in StyleSheet entries instead of
// raw numbers so the typographic scale stays consistent across screens.
export const IOSText = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: '700' as const },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: '600' as const },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600' as const },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400' as const },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: '400' as const },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: '400' as const },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  caption1: { fontSize: 12, lineHeight: 16, fontWeight: '400' as const },
  caption2: { fontSize: 11, lineHeight: 13, fontWeight: '400' as const },
} as const;
