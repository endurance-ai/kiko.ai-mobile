import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';
import { useAuth } from '@/state/auth';
import { useSubscription } from '@/state/subscription';

type Row = {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  destructive?: boolean;
  onPress: () => void;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { subscription } = useSubscription();

  const confirmLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠어요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const sections: Row[][] = [
    [
      {
        id: 'profile',
        icon: 'person',
        title: '프로필',
        subtitle: '성명 · 계정 삭제',
        onPress: () => router.push('/profile'),
      },
      {
        id: 'billing',
        icon: 'creditcard',
        title: '결제',
        subtitle: subscription.active ? 'Pro 플랜' : 'Pro 이용하기',
        onPress: () => router.push('/billing'),
      },
      {
        id: 'notifications',
        icon: 'bell',
        title: '알림',
        onPress: () => router.push('/notifications'),
      },
      {
        id: 'privacy',
        icon: 'shield',
        title: '개인정보',
        onPress: () => router.push('/privacy'),
      },
    ],
    [
      {
        id: 'logout',
        icon: 'rectangle.portrait.and.arrow.right',
        title: '로그아웃',
        destructive: true,
        onPress: confirmLogout,
      },
    ],
  ];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + FLOATING_HEADER_OFFSET },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {sections.map((rows, idx) => (
          <View key={idx} style={styles.card}>
            {rows.map((row, ridx) => (
              <Pressable
                key={row.id}
                onPress={() => {
                  Haptic.light();
                  row.onPress();
                }}
                style={[styles.row, ridx > 0 && styles.rowDivider]}
              >
                <View
                  style={[
                    styles.iconBox,
                    row.destructive && styles.iconBoxDestructive,
                  ]}
                >
                  <SymbolView
                    name={row.icon as never}
                    size={20}
                    tintColor={
                      row.destructive ? IOSColors.systemRed : IOSColors.label
                    }
                    weight="regular"
                  />
                </View>
                <View style={styles.rowText}>
                  <Text
                    style={[
                      styles.rowTitle,
                      row.destructive && { color: IOSColors.systemRed },
                    ]}
                  >
                    {row.title}
                  </Text>
                  {row.subtitle && (
                    <Text style={styles.rowSubtitle}>{row.subtitle}</Text>
                  )}
                </View>
                {!row.destructive && (
                  <SymbolView
                    name="chevron.right"
                    size={13}
                    tintColor={IOSColors.tertiaryLabel}
                    weight="semibold"
                  />
                )}
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      <FloatingHeader title="설정" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.secondarySystemBackground,
  },

  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },

  card: {
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: IOSColors.tertiarySystemBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxDestructive: {
    backgroundColor: 'rgba(255,59,48,0.10)',
  },
  rowText: { flex: 1 },
  rowTitle: {
    ...IOSText.body,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  rowSubtitle: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.rounded,
  },
});
