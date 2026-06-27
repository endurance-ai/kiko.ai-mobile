import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { Haptic, IOSColors } from '@/constants/ios';
import { useFeedback } from '@/state/feedback';

type Props = {
  /** Stable identifier for this agent turn (e.g. "search:42" / "fallback:42"). */
  turnKey: string;
  /** Optional server search_id — when present, propagated to POST /v1/feedback. */
  searchId?: string;
};

export function FeedbackTrigger({ turnKey, searchId }: Props) {
  const { getSubmitted } = useFeedback();
  const submitted = getSubmitted(turnKey);

  const open = (rating: 'positive' | 'negative') => {
    Haptic.light();
    const searchPart = searchId
      ? `&search=${encodeURIComponent(searchId)}`
      : '';
    router.push(
      `/feedback?turn=${encodeURIComponent(turnKey)}&rating=${rating}${searchPart}`,
    );
  };

  return (
    <View style={styles.row}>
      <Pressable
        hitSlop={8}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={() => open('positive')}
      >
        <SymbolView
          name={submitted === 'positive' ? 'hand.thumbsup.fill' : 'hand.thumbsup'}
          size={16}
          tintColor={
            submitted === 'positive' ? IOSColors.label : IOSColors.secondaryLabel
          }
          weight="medium"
        />
      </Pressable>
      <Pressable
        hitSlop={8}
        style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
        onPress={() => open('negative')}
      >
        <SymbolView
          name={submitted === 'negative' ? 'hand.thumbsdown.fill' : 'hand.thumbsdown'}
          size={16}
          tintColor={
            submitted === 'negative' ? IOSColors.label : IOSColors.secondaryLabel
          }
          weight="medium"
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPressed: {
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
});
