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

const FOOTER_NOTE =
  '동의는 언제든 끌 수 있어요. 피드백 리포트를 제출할 때 대화 전체가 전송되는 항목과 동일하게 관리돼요. (PIPA v3.3)';

type LinkRow = { id: string; label: string; url: string };
type DataRow = { id: string; title: string; hint: string };

const LINKS: LinkRow[] = [
  { id: 'policy', label: '개인정보 처리방침', url: 'https://kikoai.me/privacy' },
  { id: 'terms', label: '이용약관', url: 'https://kikoai.me/terms' },
];

const DATA_TOGGLES: DataRow[] = [
  { id: 'personalize', title: '맞춤 추천에 내 활동 사용', hint: '찜 · 검색으로 추천 개선' },
  { id: 'training', title: '학습 데이터 제공', hint: '가명처리 후 모델 개선' },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const [consent, setConsent] = useState<Record<string, boolean>>({
    personalize: true,
    training: false,
  });

  const toggle = (id: string) => (v: boolean) => {
    setConsent((prev) => ({ ...prev, [id]: v }));
    // TODO: PATCH /me/consent { [id]: v, version: 'v3.3', ts }
  };

  const openDoc = async (url: string) => {
    Haptic.light();
    await Linking.openURL(url);
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
        {/* Links */}
        <View style={styles.card}>
          {LINKS.map((l, idx) => (
            <Pressable
              key={l.id}
              style={[styles.linkRow, idx > 0 && styles.rowDivider]}
              onPress={() => openDoc(l.url)}
            >
              <Text style={styles.linkLabel}>{l.label}</Text>
              <SymbolView
                name="arrow.up.right"
                size={14}
                tintColor={IOSColors.tertiaryLabel}
                weight="semibold"
              />
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>데이터</Text>
        <View style={styles.card}>
          {DATA_TOGGLES.map((d, idx) => (
            <View
              key={d.id}
              style={[styles.toggleRow, idx > 0 && styles.rowDivider]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>{d.title}</Text>
                <Text style={styles.toggleHint}>{d.hint}</Text>
              </View>
              <GlassToggle value={consent[d.id]} onValueChange={toggle(d.id)} />
            </View>
          ))}
        </View>

        <Text style={styles.footerNote}>{FOOTER_NOTE}</Text>
      </ScrollView>

      <FloatingHeader title="개인정보" />
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

  card: {
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
    overflow: 'hidden',
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  linkLabel: {
    ...IOSText.body,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  sectionLabel: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    marginTop: 6,
    marginLeft: 4,
    fontFamily: IOSFont.rounded,
  },

  toggleRow: {
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
  toggleTitle: {
    ...IOSText.body,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  toggleHint: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.rounded,
  },

  footerNote: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    lineHeight: 18,
    marginTop: 4,
    paddingHorizontal: 4,
    fontFamily: IOSFont.rounded,
  },
});
