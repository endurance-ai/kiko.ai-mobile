import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import {
  FeedbackRating,
  NEGATIVE_REASONS,
  POSITIVE_REASONS,
  useFeedback,
} from '@/state/feedback';

const CONSENT_NOTICE =
  '이 보고서를 제출하면 현재 대화 전체가 Endurance AI로 전송되어 향후 모델 개선에 사용됩니다.';

export default function FeedbackScreen() {
  const params = useLocalSearchParams<{ turn?: string; rating?: string }>();
  const { submit } = useFeedback();
  const rating: FeedbackRating = params.rating === 'positive' ? 'positive' : 'negative';
  const turnKey = (params.turn as string) ?? 'unknown';
  const reasons = rating === 'positive' ? POSITIVE_REASONS : NEGATIVE_REASONS;

  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const title = useMemo(
    () =>
      rating === 'positive'
        ? '이 응답, 어떤 점이 좋았나요?'
        : '이 응답, 어떤 점이 아쉬웠나요?',
    [rating],
  );
  const placeholder =
    rating === 'positive'
      ? '이 응답의 어떤 점이 좋았나요?'
      : '이 응답의 어떤 점이 아쉬웠나요?';

  const canSubmit = note.trim().length > 0;

  const togglePick = (r: string) => {
    Haptic.selection();
    setPicked((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    Haptic.success();
    submit({
      turnKey,
      rating,
      reasons: picked,
      note: note.trim(),
    });
    router.dismiss();
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>해당되는 걸 고르고, 한 줄 적어줘.</Text>

        <View style={styles.chipRow}>
          {reasons.map((r) => {
            const active = picked.includes(r);
            return (
              <Pressable
                key={r}
                onPress={() => togglePick(r)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {r}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder={placeholder}
          placeholderTextColor={IOSColors.placeholderText}
          multiline
          style={styles.noteInput}
        />

        <View style={styles.consentBox}>
          <Text style={styles.consentText}>{CONSENT_NOTICE}</Text>
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
        <Pressable
          disabled={!canSubmit}
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>제출</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.systemBackground },
  body: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    ...IOSText.title3,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  subtitle: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    marginTop: 6,
    marginBottom: 18,
    fontFamily: IOSFont.rounded,
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: IOSColors.separator,
  },
  chipActive: {
    borderColor: IOSColors.label,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  chipText: {
    ...IOSText.subhead,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  chipTextActive: {
    color: IOSColors.label,
    fontWeight: '700',
  },

  noteInput: {
    ...IOSText.body,
    color: IOSColors.label,
    minHeight: 88,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: IOSColors.separator,
    backgroundColor: IOSColors.secondarySystemBackground,
    textAlignVertical: 'top',
    fontFamily: IOSFont.rounded,
  },

  consentBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: IOSColors.secondarySystemBackground,
  },
  consentText: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    lineHeight: 18,
    fontFamily: IOSFont.rounded,
  },

  footerSafe: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
    backgroundColor: IOSColors.systemBackground,
  },
  submit: {
    height: 52,
    borderRadius: 14,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitDisabled: {
    backgroundColor: IOSColors.systemGray4,
  },
  submitText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
});
