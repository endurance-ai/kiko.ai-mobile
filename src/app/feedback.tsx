import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { ApiError } from '@/lib/api';
import { submitFeedback } from '@/lib/feedback';
import {
  FeedbackRating,
  NEGATIVE_REASONS,
  POSITIVE_REASONS,
  useFeedback,
} from '@/state/feedback';
import type { FeedbackReasonKey } from '@/types/api';

const CONSENT_NOTICE =
  '이 보고서를 제출하면 현재 대화 전체가 Endurance AI로 전송되어 향후 모델 개선에 사용됩니다.';

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    turn?: string;
    rating?: string;
    search?: string;
  }>();
  const { rememberSubmitted } = useFeedback();
  const rating: FeedbackRating = params.rating === 'positive' ? 'positive' : 'negative';
  const turnKey = (params.turn as string) ?? 'unknown';
  const searchId = (params.search as string) || undefined;
  const reasons = rating === 'positive' ? POSITIVE_REASONS : NEGATIVE_REASONS;

  const [picked, setPicked] = useState<FeedbackReasonKey[]>([]);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const canSubmit = note.trim().length > 0 && !submitting;

  const togglePick = (k: FeedbackReasonKey) => {
    Haptic.selection();
    setPicked((prev) =>
      prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k],
    );
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await submitFeedback({
        search_id: searchId,
        rating,
        reasons: picked,
        comment: note.trim(),
        // Per design notice: submitting implies the conversation snapshot may
        // be used for model improvement.
        consent: true,
      });
      rememberSubmitted({ turnKey, rating, reasons: picked, note: note.trim() });
      Haptic.success();
      router.dismiss();
    } catch (e) {
      Haptic.error();
      Alert.alert(
        '제출 실패',
        e instanceof ApiError ? e.detail : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>해당되는 걸 고르고, 한 줄 적어줘.</Text>

        <View style={styles.chipRow}>
          {reasons.map((r) => {
            const active = picked.includes(r.key);
            return (
              <Pressable
                key={r.key}
                onPress={() => togglePick(r.key)}
                disabled={submitting}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {r.label}
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
          editable={!submitting}
          multiline
          style={styles.noteInput}
        />

        <View style={styles.consentBox}>
          <Text style={styles.consentText}>{CONSENT_NOTICE}</Text>
        </View>
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Pressable
          disabled={!canSubmit}
          style={[styles.submit, !canSubmit && styles.submitDisabled]}
          onPress={handleSubmit}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={IOSColors.systemBackground} />
          ) : (
            <Text style={styles.submitText}>제출</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.systemBackground },
  body: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
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

  footer: {
    paddingHorizontal: 20,
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
