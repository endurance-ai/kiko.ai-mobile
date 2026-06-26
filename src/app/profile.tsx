import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { ApiError } from '@/lib/api';
import { deleteMe, getMe, updateMe } from '@/lib/me';
import { useAuth } from '@/state/auth';
import type { UserProfile } from '@/types/api';

const DELETE_NOTICE =
  '삭제 시 찜·히스토리·취향 데이터가 모두 지워져요. 구독 중이라면 App Store 구독은 별도로 해지해 주세요.';

const PROVIDER_LABEL: Record<string, string> = {
  apple: 'Apple ID',
  google: 'Google',
};

function providerSummary(profile: UserProfile): string {
  const label = PROVIDER_LABEL[profile.provider] ?? profile.provider;
  return profile.email ? `${label} · ${profile.email}` : label;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const me = await getMe();
      setProfile(me);
      setName(me.display_name ?? '');
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '프로필을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleNameBlur = useCallback(async () => {
    if (!profile) return;
    const trimmed = name.trim();
    if (trimmed === (profile.display_name ?? '')) return;
    setSaving(true);
    try {
      const res = await updateMe({ display_name: trimmed });
      setProfile({ ...profile, display_name: res.display_name });
      Haptic.success();
    } catch (e) {
      Haptic.error();
      Alert.alert('저장 실패', e instanceof ApiError ? e.detail : '잠시 후 다시 시도해주세요.');
      setName(profile.display_name ?? '');
    } finally {
      setSaving(false);
    }
  }, [profile, name]);

  const confirmDelete = useCallback(() => {
    Haptic.warning();
    Alert.alert(
      '계정 삭제',
      '정말 삭제할까요? 모든 데이터가 영구히 지워져요. 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try {
              await deleteMe();
              await signOut();
              Haptic.success();
              router.dismissAll();
              router.replace('/login');
            } catch (e) {
              Haptic.error();
              Alert.alert(
                '삭제 실패',
                e instanceof ApiError ? e.detail : '잠시 후 다시 시도해주세요.',
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  }, [signOut]);

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.body,
            { paddingTop: insets.top + FLOATING_HEADER_OFFSET },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {loading && (
            <View style={styles.center}>
              <ActivityIndicator />
            </View>
          )}

          {error && !loading && (
            <View style={styles.center}>
              <Text style={styles.muted}>{error}</Text>
              <Pressable onPress={() => void load()} style={styles.retry}>
                <Text style={styles.retryText}>다시 시도</Text>
              </Pressable>
            </View>
          )}

          {profile && !loading && (
            <>
              <View style={styles.labelRow}>
                <Text style={styles.label}>성명</Text>
                {saving && (
                  <ActivityIndicator size="small" color={IOSColors.secondaryLabel} />
                )}
              </View>
              <TextInput
                value={name}
                onChangeText={setName}
                onBlur={() => void handleNameBlur()}
                style={styles.input}
                placeholder="표시할 이름"
                placeholderTextColor={IOSColors.placeholderText}
                returnKeyType="done"
                editable={!saving && !deleting}
              />

              <Text style={styles.label}>로그인 계정</Text>
              <View style={[styles.input, styles.inputReadonly]}>
                <Text style={styles.accountText} numberOfLines={1}>
                  {providerSummary(profile)}
                </Text>
              </View>

              <Pressable
                onPress={confirmDelete}
                disabled={deleting}
                style={[styles.deleteCard, deleting && { opacity: 0.5 }]}
              >
                <Text style={styles.deleteTitle}>계정 삭제</Text>
                {deleting ? (
                  <ActivityIndicator size="small" color={IOSColors.systemRed} />
                ) : (
                  <SymbolView
                    name="chevron.right"
                    size={13}
                    tintColor={IOSColors.systemRed}
                    weight="semibold"
                  />
                )}
              </Pressable>

              <Text style={styles.footerNote}>{DELETE_NOTICE}</Text>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <FloatingHeader title="프로필" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },

  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  center: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 12,
  },
  muted: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  retry: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  retryText: {
    ...IOSText.callout,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  label: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.rounded,
  },
  input: {
    ...IOSText.body,
    color: IOSColors.label,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: IOSColors.systemBackground,
    marginBottom: 20,
    fontFamily: IOSFont.rounded,
  },
  inputReadonly: {
    justifyContent: 'center',
  },
  accountText: {
    ...IOSText.body,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.rounded,
  },

  deleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: IOSColors.systemBackground,
    marginTop: 4,
  },
  deleteTitle: {
    ...IOSText.body,
    fontWeight: '700',
    color: IOSColors.systemRed,
    fontFamily: IOSFont.rounded,
  },

  footerNote: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    marginTop: 14,
    lineHeight: 18,
    paddingHorizontal: 4,
    fontFamily: IOSFont.rounded,
  },
});
