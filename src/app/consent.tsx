import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { ApiError } from '@/lib/api';
import {
  getLegalVersions,
  missingConsents,
  recordConsent,
} from '@/lib/legal';
import type { LegalDocumentType } from '@/types/api';

const DOC_LABEL: Record<LegalDocumentType, string> = {
  tos: '서비스 이용약관',
  privacy: '개인정보 처리방침',
};

/**
 * Onboarding consent gate. Reached from app entry when getLegalVersions()
 * reports any missing/stale consent for the current TOS or Privacy version.
 * Submitting accepts every outstanding doc and routes back home.
 */
export default function ConsentScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ next?: string }>();
  const nextPath = (params.next as string) || '/home';

  const [pending, setPending] = useState<
    { doc: LegalDocumentType; version: string }[] | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await getLegalVersions();
      const missing = missingConsents(res);
      setPending(
        missing.map((doc) => ({
          doc,
          version: doc === 'tos' ? res.current.tos : res.current.privacy,
        })),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '약관 정보를 불러오지 못했어요');
      setPending([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAcceptAll = useCallback(async () => {
    if (!pending || submitting) return;
    setSubmitting(true);
    Haptic.medium();
    try {
      for (const item of pending) {
        await recordConsent(item.doc, item.version);
      }
      Haptic.success();
      router.replace(nextPath as never);
    } catch (e) {
      Haptic.error();
      Alert.alert(
        '제출 실패',
        e instanceof ApiError ? e.detail : '잠시 후 다시 시도해주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  }, [pending, submitting, nextPath]);

  if (pending === null) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator />
      </View>
    );
  }

  // If nothing to consent (shouldn't normally reach here, but harmless), pass through.
  if (pending.length === 0 && !error) {
    router.replace(nextPath as never);
    return null;
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>약관 동의가 필요해요</Text>
        <Text style={styles.subtitle}>
          서비스 이용을 위해 아래 약관에 동의해주세요.
        </Text>

        <View style={styles.card}>
          {pending.map((item, i) => (
            <View
              key={item.doc}
              style={[styles.row, i > 0 && styles.rowDivider]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{DOC_LABEL[item.doc]}</Text>
                <Text style={styles.rowVersion}>버전 {item.version}</Text>
              </View>
            </View>
          ))}
        </View>

        {error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.submit, submitting && styles.submitDisabled]}
          onPress={handleAcceptAll}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color={IOSColors.systemBackground} />
          ) : (
            <Text style={styles.submitText}>모두 동의하고 시작</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },
  center: { alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 20 },

  title: {
    ...IOSText.title2,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  subtitle: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    marginTop: 8,
    marginBottom: 24,
    fontFamily: IOSFont.rounded,
  },

  card: {
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  rowText: { flex: 1 },
  rowTitle: {
    ...IOSText.body,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  rowVersion: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.rounded,
  },

  errorText: {
    ...IOSText.footnote,
    color: IOSColors.systemRed,
    marginTop: 16,
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
  submitDisabled: { backgroundColor: IOSColors.systemGray4 },
  submitText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
});
