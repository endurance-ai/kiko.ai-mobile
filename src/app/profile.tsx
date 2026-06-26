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
import type { UserGender, UserProfile } from '@/types/api';

const DELETE_NOTICE =
  '삭제 시 찜 · 히스토리 · 취향 데이터가 모두 지워져요.\n구독 중이라면 App Store 구독은 별도로 해지해 주세요.';

const GENDER_OPTIONS: { value: UserGender; label: string }[] = [
  { value: 'female', label: '여성' },
  { value: 'male', label: '남성' },
  { value: 'other', label: '기타' },
];

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
  const [gender, setGender] = useState<UserGender | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const me = await getMe();
      setProfile(me);
      setName(me.display_name ?? '');
      setGender(me.gender);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : '프로필을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isDirty =
    profile !== null &&
    (name.trim() !== (profile.display_name ?? '') || gender !== profile.gender);

  const handleSave = useCallback(async () => {
    if (!profile || !isDirty || saving) return;
    Haptic.medium();
    setSaving(true);
    try {
      const patch: { display_name?: string; gender?: UserGender | null } = {};
      const trimmed = name.trim();
      if (trimmed !== (profile.display_name ?? '')) patch.display_name = trimmed;
      if (gender !== profile.gender) patch.gender = gender;
      const res = await updateMe(patch);
      setProfile({ ...profile, display_name: res.display_name, gender: res.gender });
      Haptic.success();
    } catch (e) {
      Haptic.error();
      Alert.alert('저장 실패', e instanceof ApiError ? e.detail : '잠시 후 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }, [profile, isDirty, saving, name, gender]);

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
              <View style={styles.avatarWrap}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(name.trim().charAt(0) || profile.provider.charAt(0)).toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>성명</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                style={styles.input}
                placeholder="표시할 이름"
                placeholderTextColor={IOSColors.placeholderText}
                returnKeyType="done"
                editable={!saving && !deleting}
              />

              <Text style={styles.label}>성별</Text>
              <View style={styles.genderRow}>
                {GENDER_OPTIONS.map((opt) => {
                  const active = gender === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        Haptic.light();
                        setGender(active ? null : opt.value);
                      }}
                      style={[styles.genderBtn, active && styles.genderBtnActive]}
                      disabled={saving || deleting}
                    >
                      <Text
                        style={[
                          styles.genderText,
                          active && styles.genderTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.label}>로그인 계정</Text>
              <View style={[styles.input, styles.inputReadonly]}>
                <Text style={styles.accountText} numberOfLines={1}>
                  {providerSummary(profile)}
                </Text>
              </View>

              <Pressable
                onPress={handleSave}
                disabled={!isDirty || saving || deleting}
                style={[
                  styles.saveBtn,
                  (!isDirty || saving) && styles.saveBtnDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={IOSColors.systemBackground} />
                ) : (
                  <Text style={styles.saveBtnText}>저장</Text>
                )}
              </Pressable>

              <Pressable
                onPress={confirmDelete}
                disabled={deleting}
                style={[styles.deleteCard, deleting && { opacity: 0.5 }]}
              >
                <View style={styles.deleteIconBox}>
                  {deleting ? (
                    <ActivityIndicator size="small" color={IOSColors.systemRed} />
                  ) : (
                    <SymbolView
                      name="trash"
                      size={20}
                      tintColor={IOSColors.systemRed}
                      weight="medium"
                    />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.deleteTitle}>계정 삭제</Text>
                  <Text style={styles.deleteSubtitle}>탈퇴 · 데이터 완전 삭제</Text>
                </View>
                <SymbolView
                  name="chevron.right"
                  size={13}
                  tintColor={IOSColors.systemRed}
                  weight="semibold"
                />
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

const AVATAR_SIZE = 96;

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
  avatarWrap: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 30,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },

  label: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    marginBottom: 8,
    fontFamily: IOSFont.rounded,
  },
  input: {
    ...IOSText.body,
    color: IOSColors.label,
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
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

  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  genderBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genderBtnActive: {
    backgroundColor: IOSColors.label,
    borderColor: IOSColors.label,
  },
  genderText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  genderTextActive: {
    color: IOSColors.systemBackground,
  },

  saveBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    ...IOSText.body,
    fontWeight: '700',
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },

  deleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    marginTop: 4,
  },
  deleteIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,59,48,0.10)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteTitle: {
    ...IOSText.body,
    fontWeight: '700',
    color: IOSColors.systemRed,
    fontFamily: IOSFont.rounded,
  },
  deleteSubtitle: {
    ...IOSText.footnote,
    color: IOSColors.systemRed,
    opacity: 0.7,
    marginTop: 2,
    fontFamily: IOSFont.rounded,
  },

  footerNote: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    marginTop: 18,
    lineHeight: 18,
    fontFamily: IOSFont.rounded,
  },
});
