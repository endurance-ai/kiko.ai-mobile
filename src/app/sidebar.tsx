import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Haptic, IOSColors, IOSFont, IOSText } from "@/constants/ios";
import { ApiError } from "@/lib/api";
import { deleteSession, listSessions, renameSession } from "@/lib/chat";
import { getMe } from "@/lib/me";
import type { SessionSummary, UserProfile } from "@/types/api";

const SCREEN_W = Dimensions.get("window").width;
const PANEL_W = Math.min(SCREEN_W * 0.82, 360);

const OPEN_MS = 260;
const CLOSE_MS = 200;

export default function SidebarScreen() {
  const { current: currentSessionId } = useLocalSearchParams<{
    current?: string;
  }>();
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [me, setMe] = useState<UserProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listSessions();
        if (!cancelled) setSessions(list);
      } catch {
        if (!cancelled) setSessions([]);
      }
    })();
    (async () => {
      try {
        const profile = await getMe();
        if (!cancelled) setMe(profile);
      } catch {
        // ignore — fallback initial
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const slide = useRef(new Animated.Value(-PANEL_W)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dim, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [slide, dim]);

  const animateClose = (after: () => void) => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: -PANEL_W,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(dim, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(after);
  };

  const close = () => animateClose(() => router.back());

  const goNewChat = () => {
    Haptic.medium();
    animateClose(() => {
      router.back();
      // Reset home into the empty 'new chat' surface.
      setTimeout(() => router.replace("/home" as never), 30);
    });
  };

  const goSession = (sessionId: string) => {
    Haptic.light();
    animateClose(() => {
      router.back();
      // Reuse the home surface (top bar + composer) — just hydrate it with
      // the picked session's messages via the ?session= query param.
      setTimeout(
        () => router.replace(`/home?session=${sessionId}` as never),
        30,
      );
    });
  };

  const goProfile = () => {
    Haptic.light();
    animateClose(() => {
      router.back();
      setTimeout(() => router.push("/settings"), 30);
    });
  };

  const promptRename = useCallback(
    (session: SessionSummary) => {
      const current = session.title || "";
      Alert.prompt(
        "제목 변경",
        undefined,
        [
          { text: "취소", style: "cancel" },
          {
            text: "저장",
            onPress: async (input?: string) => {
              const next = (input ?? "").trim();
              if (!next || next === current) return;
              setSessions((prev) =>
                prev
                  ? prev.map((s) =>
                      s.session_id === session.session_id
                        ? { ...s, title: next }
                        : s,
                    )
                  : prev,
              );
              try {
                await renameSession(session.session_id, next);
                Haptic.success();
              } catch (e) {
                setSessions((prev) =>
                  prev
                    ? prev.map((s) =>
                        s.session_id === session.session_id
                          ? { ...s, title: session.title }
                          : s,
                      )
                    : prev,
                );
                Haptic.error();
                Alert.alert(
                  "이름 변경 실패",
                  e instanceof ApiError ? e.detail : "잠시 후 다시 시도해주세요.",
                );
              }
            },
          },
        ],
        "plain-text",
        current,
      );
    },
    [],
  );

  const confirmDelete = useCallback(
    (session: SessionSummary) => {
      Haptic.warning();
      Alert.alert(
        "대화 삭제",
        "이 대화와 모든 메시지가 영구히 지워져요.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "삭제",
            style: "destructive",
            onPress: async () => {
              const snapshot = sessions;
              const wasActive = currentSessionId === session.session_id;
              setSessions((prev) =>
                prev ? prev.filter((s) => s.session_id !== session.session_id) : prev,
              );
              try {
                await deleteSession(session.session_id);
                Haptic.success();
                // If the active chat was the one deleted, drop the user back
                // into a fresh home surface so they're not looking at stale messages.
                if (wasActive) {
                  animateClose(() => {
                    router.back();
                    setTimeout(() => router.replace("/home" as never), 30);
                  });
                }
              } catch (e) {
                setSessions(snapshot);
                Haptic.error();
                Alert.alert(
                  "삭제 실패",
                  e instanceof ApiError ? e.detail : "잠시 후 다시 시도해주세요.",
                );
              }
            },
          },
        ],
      );
    },
    [sessions, currentSessionId],
  );

  const openSessionActions = useCallback(
    (session: SessionSummary) => {
      Haptic.medium();
      const title = session.title || "제목 없음";
      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            title,
            options: ["취소", "제목 변경", "삭제"],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 0,
          },
          (idx) => {
            if (idx === 1) promptRename(session);
            else if (idx === 2) confirmDelete(session);
          },
        );
      } else {
        Alert.alert(title, undefined, [
          { text: "취소", style: "cancel" },
          { text: "제목 변경", onPress: () => promptRename(session) },
          {
            text: "삭제",
            style: "destructive",
            onPress: () => confirmDelete(session),
          },
        ]);
      }
    },
    [promptRename, confirmDelete],
  );

  const displayName = me?.display_name?.trim() || "";
  const avatarChar = (
    displayName.charAt(0) ||
    me?.email?.charAt(0) ||
    me?.provider?.charAt(0) ||
    "?"
  ).toUpperCase();
  const avatarLabel = displayName || me?.email?.split("@")[0] || "프로필";

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.backdrop, { opacity: dim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View
        style={[styles.panel, { transform: [{ translateX: slide }] }]}
      >
        <SafeAreaView edges={["top"]} style={styles.panelInner}>
          <View style={styles.body}>
            <Text style={styles.brand}>Kiko.</Text>

            <Text style={styles.sectionLabel}>최근 항목</Text>

            {sessions === null ? (
              <View style={styles.listLoading}>
                <ActivityIndicator />
              </View>
            ) : sessions.length === 0 ? (
              <Text style={styles.emptyHint}>아직 대화가 없어요</Text>
            ) : (
              <ScrollView
                contentContainerStyle={styles.historyList}
                showsVerticalScrollIndicator={false}
              >
                {sessions.map((s) => {
                  const active = currentSessionId === s.session_id;
                  return (
                    <Pressable
                      key={s.session_id}
                      style={[
                        styles.historyRow,
                        active && styles.historyRowActive,
                      ]}
                      onPress={() => goSession(s.session_id)}
                      onLongPress={() => openSessionActions(s)}
                      delayLongPress={350}
                    >
                      <Text
                        style={[
                          styles.historyTitle,
                          active && styles.historyTitleActive,
                        ]}
                        numberOfLines={1}
                      >
                        {s.title || "제목 없음"}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <SafeAreaView edges={["bottom"]} style={styles.bottomSafe}>
            <View style={styles.bottomRow}>
              <Pressable
                style={styles.avatarBtn}
                onPress={goProfile}
                accessibilityLabel={`${avatarLabel} 프로필 설정`}
              >
                <Text style={styles.avatarText}>{avatarChar}</Text>
              </Pressable>

              <Pressable style={styles.newChatBtn} onPress={goNewChat}>
                <SymbolView
                  name="plus"
                  size={14}
                  tintColor={IOSColors.systemBackground}
                  weight="bold"
                />
                <Text style={styles.newChatText}>새 채팅</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.30)",
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: PANEL_W,
    backgroundColor: IOSColors.systemBackground,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
    borderRadius: 50,
  },
  panelInner: { flex: 1 },

  body: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 8,
  },

  brand: {
    fontSize: 30,
    fontWeight: "800",
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
    letterSpacing: -0.5,
    marginTop: 6,
    marginBottom: 24,
  },

  sectionLabel: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    marginBottom: 8,
    paddingHorizontal: 12,
    fontFamily: IOSFont.rounded,
  },

  listLoading: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyHint: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontFamily: IOSFont.rounded,
  },

  historyList: {
    paddingBottom: 16,
  },
  historyRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 2,
  },
  historyRowActive: {
    backgroundColor: IOSColors.systemGray6,
  },
  historyTitle: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },
  historyTitleActive: {
    fontWeight: "400",
  },

  bottomSafe: {
    paddingHorizontal: 18,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: IOSColors.systemBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarText: {
    ...IOSText.body,
    fontWeight: "700",
    color: IOSColors.label,
    fontFamily: IOSFont.rounded,
  },

  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    height: 44,
    borderRadius: 999,
    backgroundColor: IOSColors.label,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  newChatText: {
    ...IOSText.subhead,
    fontWeight: "700",
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.rounded,
  },
});
