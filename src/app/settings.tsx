import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import {
  Alert,
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
import { Haptic, IOSColors, IOSFont, IOSText } from "@/constants/ios";
import { getMe } from "@/lib/me";
import { useAuth } from "@/state/auth";
import type { UserProfile } from "@/types/api";
// useSubscription import paused with the billing row — restore when IAP returns.
// import { useSubscription } from "@/state/subscription";

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
  const [me, setMe] = useState<UserProfile | null>(null);

  // Fetch /v1/me once for the email pill above the account card. Silent
  // on failure — the pill just doesn't render in that case.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getMe();
        if (!cancelled) setMe(profile);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const confirmLogout = () => {
    Alert.alert("로그아웃", "정말 로그아웃하시겠어요?", [
      { text: "취소", style: "cancel" },
      {
        text: "로그아웃",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/login");
        },
      },
    ]);
  };

  const sections: Row[][] = [
    [
      {
        id: "profile",
        icon: "person",
        title: "프로필",
        subtitle: "성명 · 계정 삭제",
        onPress: () => router.push("/profile"),
      },
      // Billing entry hidden for the free launch — IAP comes later.
      // {
      //   id: "billing",
      //   icon: "creditcard",
      //   title: "결제",
      //   subtitle: subscription.active ? "Pro 플랜" : "Pro 이용하기",
      //   onPress: () => router.push("/billing"),
      // },
      {
        id: "notifications",
        icon: "bell",
        title: "알림",
        onPress: () => router.push("/notifications"),
      },
      {
        id: "privacy",
        icon: "shield",
        title: "개인정보",
        onPress: () => router.push("/privacy"),
      },
    ],
    [
      {
        id: "logout",
        icon: "rectangle.portrait.and.arrow.right",
        title: "로그아웃",
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
        {me?.email && (
          <View style={styles.emailPill}>
            <Text style={styles.emailText} numberOfLines={1}>
              {me.email}
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>계정</Text>

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
                <View style={styles.rowText}>
                  <Text
                    style={[
                      styles.rowTitle,
                      row.destructive && { color: IOSColors.systemRed },
                    ]}
                  >
                    {row.title}
                  </Text>
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

  emailPill: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
  },
  emailText: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  sectionLabel: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    paddingHorizontal: 4,
    marginTop: 6,
    marginBottom: -4, // tighten gap to the card below
  },
  card: {
    borderRadius: 20,
    backgroundColor: IOSColors.systemBackground,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
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
    borderRadius: 20,
    backgroundColor: IOSColors.tertiarySystemBackground,
    justifyContent: "center",
    alignItems: "center",
  },
  iconBoxDestructive: {
    backgroundColor: "rgba(255,59,48,0.10)",
  },
  rowText: { flex: 1 },
  rowTitle: {
    ...IOSText.body,
    fontWeight: "400",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  rowSubtitle: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    marginTop: 2,
    fontFamily: IOSFont.sans,
  },
});
