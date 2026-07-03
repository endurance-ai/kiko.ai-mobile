import Slider from '@react-native-community/slider';
import { GlassSurface } from '@/components/glass-surface';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import {
  buildPriceLabel,
  GENDER_LABEL,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  useFilter,
  type Gender,
} from '@/state/filter';

const GENDERS: Gender[] = ['unisex', 'women', 'men'];

export default function FilterScreen() {
  const { value, setValue } = useFilter();
  const [gender, setGender] = useState<Gender>(value.gender);
  const [priceMax, setPriceMax] = useState<number>(value.priceMax);

  const pickGender = (g: Gender) => {
    Haptic.selection();
    setGender(g);
  };

  const apply = () => {
    Haptic.medium();
    setValue({ gender, priceMax });
    router.back();
  };

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        <Text style={styles.sectionTitle}>성별</Text>
        <View style={styles.chipRow}>
          {GENDERS.map((g) => {
            const active = gender === g;
            return (
              <Pressable key={g} onPress={() => pickGender(g)}>
                <GlassSurface
                  variant="pill"
                  isInteractive={!active}
                  glassStyle={active ? 'none' : 'clear'}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {GENDER_LABEL[g]}
                  </Text>
                </GlassSurface>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.priceHeaderRow}>
          <Text style={styles.sectionTitle}>가격</Text>
          <Text style={styles.priceValue}>{buildPriceLabel(priceMax)}</Text>
        </View>

        <Slider
          style={styles.slider}
          minimumValue={PRICE_MIN}
          maximumValue={PRICE_MAX}
          step={PRICE_STEP}
          value={priceMax}
          onValueChange={setPriceMax}
          onSlidingComplete={() => Haptic.selection()}
          minimumTrackTintColor={IOSColors.label}
          maximumTrackTintColor={IOSColors.systemGray5}
        />
        <View style={styles.sliderScale}>
          <Text style={styles.scaleLabel}>{PRICE_MIN}만원</Text>
          <Text style={styles.scaleLabel}>{PRICE_MAX}만원</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.applyBtn} onPress={apply}>
          <Text style={styles.applyText}>적용</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.systemBackground,
  },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  sectionTitle: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: IOSFont.sans,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    overflow: 'hidden',
  },
  chipActive: {
    backgroundColor: IOSColors.label,
    borderColor: IOSColors.label,
  },
  chipText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  chipTextActive: {
    color: IOSColors.systemBackground,
  },

  priceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 28,
  },
  priceValue: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    marginBottom: 12,
    fontFamily: IOSFont.sans,
  },
  slider: {
    width: '100%',
    height: 32,
  },
  sliderScale: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  scaleLabel: {
    ...IOSText.caption1,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },

  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  applyBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
});
