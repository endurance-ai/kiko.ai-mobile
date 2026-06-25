import { GlassView } from 'expo-glass-effect';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';

type Row = {
  id: string;
  icon: string;
  title: string;
  subtitle?: string;
  destructive?: boolean;
  onPress: () => void;
};

export default function SettingsScreen() {
  const close = () => router.dismiss();

  const sections: Row[][] = [
    [
      {
        id: 'profile',
        icon: 'person',
        title: '프로필',
        subtitle: '성명 · 계정 삭제',
        onPress: () => {
          router.dismiss();
          router.push('/profile');
        },
      },
      {
        id: 'billing',
        icon: 'creditcard',
        title: '결제',
        subtitle: '구독 관리',
        onPress: () => {
          router.dismiss();
          router.push('/billing');
        },
      },
      {
        id: 'notifications',
        icon: 'bell',
        title: '알림',
        onPress: () => {
          router.dismiss();
          router.push('/notifications');
        },
      },
      {
        id: 'privacy',
        icon: 'shield',
        title: '개인정보',
        onPress: () => {
          router.dismiss();
          router.push('/privacy');
        },
      },
    ],
    [
      {
        id: 'logout',
        icon: 'rectangle.portrait.and.arrow.right',
        title: '로그아웃',
        destructive: true,
        onPress: () => {
          router.dismiss();
          router.replace('/');
        },
      },
    ],
  ];

  return (
    <View style={styles.root}>
      <View style={styles.grabSpacer} />
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>설정</Text>
        <Pressable
          hitSlop={8}
          onPress={() => {
            Haptic.light();
            close();
          }}
        >
          <GlassView glassEffectStyle="clear" style={styles.closeBtn}>
            <SymbolView
              name="xmark"
              size={14}
              tintColor={IOSColors.label}
              weight="bold"
            />
          </GlassView>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
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
                    name={row.icon as any}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.secondarySystemBackground,
  },
  grabSpacer: {
    height: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 18,
  },
  headerSpacer: { width: 32 },
  headerTitle: {
    ...IOSText.title3,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },

  body: {
    paddingHorizontal: 20,
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
