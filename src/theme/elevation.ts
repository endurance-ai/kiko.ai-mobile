/**
 * Elevation / shadow scale.
 *
 * iOS-native aesthetic: soft, near-black shadows with tight offsets. The
 * scale is small on purpose — depth in Kiko AI comes primarily from Liquid
 * Glass (see `@/components/glass-surface`) and only secondarily from
 * shadows. Reach for the LOWEST level that still communicates the depth.
 *
 * Each preset is a ready-to-spread `ViewStyle` fragment. Example:
 *   <View style={[styles.card, Elevation.lifted]} />
 *
 * On Android, `elevation` handles depth (Material). We include both so
 * cross-platform surfaces don't need duplicate logic.
 */

import type { ViewStyle } from 'react-native';

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

/** No shadow — for flat surfaces sitting on a background */
export const flat: ShadowStyle = {
  shadowOpacity: 0,
  elevation: 0,
};

/** Hairline lift — pills, chips, chip groups sitting on content */
export const raised: ShadowStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.08,
  shadowRadius: 3,
  elevation: 2,
};

/** Composer bar / floating input — enough to separate from scrollable content */
export const lifted: ShadowStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 6,
  elevation: 3,
};

/** Card in front of a busy background — clear separation but not heavy */
export const floating: ShadowStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.12,
  shadowRadius: 12,
  elevation: 5,
};

/** Modal / bottom sheet — establishes a new depth plane */
export const overlay: ShadowStyle = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.18,
  shadowRadius: 24,
  elevation: 10,
};

export const Elevation = {
  flat,
  raised,
  lifted,
  floating,
  overlay,
} as const;
