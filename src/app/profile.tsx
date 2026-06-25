import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
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

const DELETE_NOTICE =
  '삭제 시 찜 · 히스토리 · 취향 데이터가 모두 지워져요.\n구독 중이라면 App Store 구독은 별도로 해지해 주세요.';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('강현규');
  const account = 'Apple ID · hkang@...';

  const confirmDelete = () => {
    Haptic.warning();
    Alert.alert(
      '계정 삭제',
      '정말 삭제할까요? 모든 데이터가 영구히 지워져요. 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            // TODO: DELETE /me cascade — operational + linked profile.
            // 가명 학습셋(2-스토어)은 비연결로 격리 유지.
            Haptic.success();
            router.dismissAll();
            router.replace('/');
          },
        },
      ],
    );
  };

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
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(name.trim().charAt(0) || '현').toUpperCase()}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>성명</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={styles.input}
            placeholderTextColor={IOSColors.placeholderText}
            returnKeyType="done"
          />

          <Text style={styles.label}>로그인 계정</Text>
          <View style={[styles.input, styles.inputReadonly]}>
            <Text style={styles.accountText} numberOfLines={1}>
              {account}
            </Text>
          </View>

          <Pressable onPress={confirmDelete} style={styles.deleteCard}>
            <View style={styles.deleteIconBox}>
              <SymbolView
                name="trash"
                size={20}
                tintColor={IOSColors.systemRed}
                weight="medium"
              />
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
        </ScrollView>
      </KeyboardAvoidingView>

      <FloatingHeader title="프로필" />
    </View>
  );
}

const AVATAR_SIZE = 96;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },

  // Body
  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
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

  // Delete card
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
