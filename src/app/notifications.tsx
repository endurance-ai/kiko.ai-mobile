import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { GlassToggle } from '@/components/glass-toggle';
import { Haptic, IOSColors, IOSFont, IOSText } from '@/constants/ios';

type Category = {
  id: string;
  title: string;
  hint: string;
};

const CATEGORIES: Category[] = [
  { id: 'trigger', title: '트리거 알림', hint: '찜 · 검색 기반 신상 추천' },
  { id: 'redig', title: '리디깅 리마인더', hint: '"그때 그 무드 이어서"' },
  { id: 'marketing', title: '마케팅 · 이벤트', hint: '혜택 · 신규 브랜드 소식' },
];

const SYSTEM_WARNING =
  '기기 알림이 꺼져 있으면 새 디깅 결과를 못 받아요. iOS 설정에서 켜 주세요.';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  // Initial values are placeholders; real values come from GET /me/notifications.
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    trigger: true,
    redig: true,
    marketing: false,
  });

  const toggle = (id: string) => (v: boolean) => {
    setPrefs((prev) => ({ ...prev, [id]: v }));
    // TODO: PATCH /me/notifications { [id]: v }  (consent log + timestamp)
  };

  const openSystemSettings = async () => {
    Haptic.light();
    await Linking.openSettings(); // iOS: openSettingsURLString
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + FLOATING_HEADER_OFFSET },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* System status notice */}
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>{SYSTEM_WARNING}</Text>
        </View>

        {/* Category toggles */}
        <View style={styles.categoryCard}>
          {CATEGORIES.map((c, idx) => (
            <View
              key={c.id}
              style={[styles.row, idx > 0 && styles.rowDivider]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{c.title}</Text>
                <Text style={styles.rowHint}>{c.hint}</Text>
              </View>
              <GlassToggle value={prefs[c.id]} onValueChange={toggle(c.id)} />
            </View>
          ))}
        </View>

        {/* Open iOS settings */}
        <Pressable style={styles.linkCard} onPress={openSystemSettings}>
          <View style={styles.linkIconBox}>
            <SymbolView
              name="gearshape"
              size={18}
              tintColor={IOSColors.label}
              weight="medium"
            />
          </View>
          <Text style={styles.linkText}>iOS 알림 설정 열기</Text>
          <SymbolView
            name="arrow.up.right"
            size={14}
            tintColor={IOSColors.tertiaryLabel}
            weight="semibold"
          />
        </Pressable>
      </ScrollView>

      <FloatingHeader title="알림" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: IOSColors.secondarySystemBackground },

  body: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 14,
  },

  warningCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: IOSColors.tertiarySystemBackground,
  },
  warningText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    lineHeight: 22,
    fontFamily: IOSFont.rounded,
  },

  categoryCard: {
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  rowTitle: {
    ...IOSText.body,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  rowHint: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.rounded,
  },

  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
  },
  linkIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: IOSColors.tertiarySystemBackground,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    ...IOSText.body,
    fontWeight: '600',
    color: IOSColors.label,
    flex: 1,
    fontFamily: IOSFont.rounded,
  },
});
