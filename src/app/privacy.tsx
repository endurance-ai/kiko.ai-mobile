import { SymbolView } from "expo-symbols";
import { useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  FLOATING_HEADER_OFFSET,
  FloatingHeader,
} from "@/components/floating-header";
import { GlassToggle } from "@/components/glass-toggle";
import { Haptic, IOSColors, IOSFont, IOSText } from "@/constants/ios";

const FOOTER_NOTE =
  "동의는 언제든 끌 수 있어요. 피드백 리포트를 제출할 때 대화 전체가 전송되는 항목과 동일하게 관리돼요.";

type LinkRow = { id: string; label: string; url: string };

const LINKS: LinkRow[] = [
  {
    id: "policy",
    label: "개인정보 처리방침",
    url: "https://kikoai.me/privacy",
  },
  { id: "terms", label: "이용약관", url: "https://kikoai.me/terms" },
];

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const [training, setTraining] = useState(false);

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
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleTitle}>학습 데이터 제공</Text>
              <Text style={styles.toggleHint}>가명처리 후 모델 개선</Text>
            </View>
            <GlassToggle value={training} onValueChange={setTraining} />
          </View>
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
    overflow: "hidden",
  },

  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  linkLabel: {
    ...IOSText.body,
    fontWeight: "400",
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  sectionLabel: {
    ...IOSText.footnote,
    fontWeight: "400",
    color: IOSColors.secondaryLabel,
    marginTop: 6,
    marginLeft: 4,
    fontFamily: IOSFont.rounded,
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
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
    fontWeight: "400",
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
