import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { IOSColors, IOSFont, IOSText } from "@/constants/ios";
import { getNotifications, updateNotifications } from "@/lib/devices";
import type { NotificationCategories } from "@/types/api";

const SYSTEM_WARNING =
  "기기 알림이 꺼져 있으면 새 디깅 결과를 못 받아요. iOS 설정에서 켜 주세요.";

// 매핑 — 화면의 2개 토글 ↔ 서버 카테고리 3개 (taste_push 는 별도 노출 X, 기본 유지)
// '알림' 토글 = system (Pro 트리거 등 핵심 푸시)
// '마케팅·이벤트' 토글 = release_alerts (혜택 / 신규 브랜드)
function readEnabled(cat: NotificationCategories): boolean {
  return cat.system !== false; // null / undefined → true 로 간주 (기본 on)
}
function readMarketing(cat: NotificationCategories): boolean {
  return cat.release_alerts === true;
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [enabled, setEnabled] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getNotifications();
        if (cancelled) return;
        setEnabled(readEnabled(res.categories));
        setMarketing(readMarketing(res.categories));
      } catch {
        // 401 / network — leave defaults; user can still toggle.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Patch only the key that changed so we don't clobber other categories
  // (e.g. taste_push) the user might have set elsewhere.
  const persist = useCallback(async (patch: NotificationCategories) => {
    try {
      await updateNotifications(patch);
    } catch {
      // silent — local state already reflects intent
    }
  }, []);

  // Turning the master toggle ON only makes sense if iOS itself allows
  // notifications. If the user previously denied at the system prompt,
  // requestPermissionsAsync immediately resolves with status=denied
  // (it cannot re-prompt) — so we deep-link to the Settings app where
  // they can flip it back on.
  const onEnabledChange = async (v: boolean) => {
    if (!v) {
      setEnabled(false);
      void persist({ system: false });
      return;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.status === "granted") {
      setEnabled(true);
      void persist({ system: true });
      return;
    }
    if (current.status === "undetermined" || current.canAskAgain) {
      const next = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      if (next.status === "granted") {
        setEnabled(true);
        void persist({ system: true });
      }
      return;
    }
    Alert.alert(
      "알림 권한이 필요해요",
      "iOS 설정에서 키코 앱의 알림을 켜 주세요.",
      [
        { text: "취소", style: "cancel" },
        { text: "설정 열기", onPress: () => void Linking.openSettings() },
      ],
    );
  };
  const onMarketingChange = (v: boolean) => {
    setMarketing(v);
    void persist({ release_alerts: v });
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
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>알림</Text>
              </View>
              <GlassToggle value={enabled} onValueChange={onEnabledChange} />
            </View>
            <View style={[styles.row, styles.rowDivider]}>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>마케팅</Text>
                <Text style={styles.rowHint}>혜택/신규 브랜드 소식</Text>
              </View>
              <GlassToggle
                value={marketing}
                onValueChange={onMarketingChange}
              />
            </View>
          </View>
        )}

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

  loadingBox: {
    paddingVertical: 40,
    alignItems: "center",
  },

  card: {
    borderRadius: 16,
    backgroundColor: IOSColors.systemBackground,
    overflow: "hidden",
  },
  row: {
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
  rowText: { flex: 1 },
  rowTitle: {
    ...IOSText.body,
    fontWeight: "400",
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
