import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { useBanner } from '@/state/banner';

/**
 * Sticky banner that sits above the composer. Shows at most one banner at a
 * time — highest priority wins (error > billing > notice). Dismissal is
 * intentional: users must take the offered action (or the banner clears itself
 * once the underlying condition resolves).
 */
export function Banner() {
  const { active } = useBanner();
  if (!active) return null;

  const handleAction = () => {
    if (!active.action) return;
    Haptic.light();
    active.action.onPress();
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.textCol}>
          <Text style={styles.title} numberOfLines={2}>
            {active.title}
          </Text>
          {active.subtitle && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {active.subtitle}
            </Text>
          )}
        </View>

        {active.action && (
          <Pressable onPress={handleAction} style={styles.actionBtn}>
            <Text style={styles.actionLabel}>{active.action.label}</Text>
            <SymbolView
              name="arrow.right"
              size={12}
              tintColor={IOSColors.systemBackground}
              weight="semibold"
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 4,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: '#0E0F11',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...IOSText.body,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: IOSFont.rounded,
  },
  subtitle: {
    ...IOSText.footnote,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    fontFamily: IOSFont.rounded,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  actionLabel: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: IOSFont.rounded,
  },
});
