import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_HEADER_OFFSET, FloatingHeader } from '@/components/floating-header';
import { GlassToggle } from '@/components/glass-toggle';
import { IOSColors, IOSFont, IOSText } from '@/constants/ios';

const SYSTEM_WARNING =
  '기기 알림이 꺼져 있으면 새 디깅 결과를 못 받아요. iOS 설정에서 켜 주세요.';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  // Placeholder until backend exposes notification prefs.
  const [enabled, setEnabled] = useState(true);
  const [marketing, setMarketing] = useState(false);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.body,
          { paddingTop: insets.top + FLOATING_HEADER_OFFSET },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>알림</Text>
            </View>
            <GlassToggle value={enabled} onValueChange={setEnabled} />
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>마케팅·이벤트</Text>
              <Text style={styles.rowHint}>혜택·신규 브랜드 소식</Text>
            </View>
            <GlassToggle value={marketing} onValueChange={setMarketing} />
          </View>
        </View>

        <Text style={styles.footerNote}>{SYSTEM_WARNING}</Text>
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
  },

  card: {
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
  rowText: { flex: 1 },
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

  footerNote: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    marginTop: 14,
    lineHeight: 18,
    paddingHorizontal: 4,
    fontFamily: IOSFont.rounded,
  },
});
