import { Image as ExpoImage } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { GlassSurface } from "@/components/glass-surface";
import { Haptic, IOSColors, IOSFont, IOSText } from "@/constants/ios";
import { ApiError } from "@/lib/api";
import { deleteSession, listSessions, renameSession } from "@/lib/chat";
import { getMe } from "@/lib/me";
import { stripFamilyName } from "@/lib/name";
import type { SessionSummary, UserProfile } from "@/types/api";

// Hoist the require out of the render path so the bundler resolves the
// asset once at module load. expo-image then reads it from its native
// memory + disk cache on every subsequent mount → the wordmark appears
// instantly on sidebar open instead of decoding after mount.
const WORDMARK_SOURCE = require("../../assets/brand/kiko-wordmark.png");

const OPEN_MS = 260;
const CLOSE_MS = 200;

export default function SidebarScreen() {
  // Live window dimensions — Dimensions.get() at module init returned the
  // pre-modal size on first open of the transparentModal, so panel width
  // ended up wrong and the whole layout re-flowed only on the SECOND open
  // (once cached). Using the hook forces a re-measure per mount.
  const window = useWindowDimensions();
  const PANEL_W = Math.min(window.width * 0.82, 360);
  const { current: currentSessionId } = useLocalSearchParams<{
    current?: string;
  }>();
  const scheme = useColorScheme();
  const wordmarkTint = scheme === "dark" ? "#FFFFFF" : "#0A0A0A";
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
  // Use the given name (이름) for the avatar — Korean surnames are
  // one-syllable, so showing display_name as-is would put 성 in the circle.
  const givenName = displayName ? stripFamilyName(displayName) : "";
  // 영문 이름 (한글이 하나도 없음) 은 원 안에 그대로 넣으면 "HYUN..." 처럼
  // 잘리니, 첫 글자만 대문자로 표시. 한글 이름은 기존대로 이름 전체 노출.
  const hasHangul = /[가-힣]/.test(givenName);
  const avatarLabelText =
    (givenName && hasHangul ? givenName : givenName.charAt(0).toUpperCase()) ||
    me?.email?.charAt(0).toUpperCase() ||
    me?.provider?.charAt(0).toUpperCase() ||
    "?";
  // Auto-scale: longer text → smaller glyph so it fits the 56pt circle.
  const avatarFontSize =
    avatarLabelText.length >= 4
      ? 12
      : avatarLabelText.length === 3
        ? 15
        : avatarLabelText.length === 2
          ? 18
          : 22;
  const avatarLabel = displayName || me?.email?.split("@")[0] || "프로필";

  return (
    <View
      style={[
        styles.root,
        // 트랜스페어런트 모달 컨테이너가 첫 마운트 시 완전히 측정되지 않아
        // flex:1 만으로는 세로 오버플로우가 남는 케이스가 있음. 라이브 window
        // 값을 명시적으로 잠가서 첫 열림부터 정확한 뷰포트에 국한시킨다.
        { width: window.width, height: window.height },
      ]}
    >
      <Animated.View style={[styles.backdrop, { opacity: dim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
      </Animated.View>

      <Animated.View
        style={[
          styles.panel,
          {
            // 가로는 라이브 window 값으로 잠그되, 세로는 top/bottom:0 로
            // 부모 컨테이너(트랜스페어런트 모달) 를 그대로 채우도록 한다.
            // 첫 마운트 때 window.height 가 상태바 등을 포함한 잘못된 값
            // 을 뱉으면서 패널이 세로로 확장되던 문제를 원천 차단.
            width: PANEL_W,
            transform: [{ translateX: slide }],
          },
        ]}
      >
        <SafeAreaView edges={["top"]} style={styles.panelInner}>
          <View style={styles.body}>
            <ExpoImage
              source={WORDMARK_SOURCE}
              style={[styles.brand, { tintColor: wordmarkTint }]}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />

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
                onPress={goProfile}
                accessibilityLabel={`${avatarLabel} 프로필 설정`}
              >
                <GlassSurface
                  variant="composer"
                  isInteractive
                  style={styles.avatarBtn}
                >
                  <Text
                    style={[styles.avatarText, { fontSize: avatarFontSize }]}
                    numberOfLines={1}
                  >
                    {avatarLabelText}
                  </Text>
                </GlassSurface>
              </Pressable>

              <Pressable onPress={goNewChat}>
                <GlassSurface
                  variant="composer"
                  isInteractive
                  style={styles.newChatBtn}
                >
                  <SymbolView
                    name="plus"
                    size={18}
                    tintColor={IOSColors.label}
                    weight="bold"
                  />
                  <Text style={styles.newChatText}>새 채팅</Text>
                </GlassSurface>
              </Pressable>
            </View>
          </SafeAreaView>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // width/height 는 inline 으로 useWindowDimensions 값 주입 — flex:1 만으로
  // 부모(트랜스페어런트 모달 컨테이너) 사이즈에 의존하지 않도록.
  root: { overflow: "hidden" },
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
    left: 0,
    bottom: 0,
    // width 만 inline 으로 지정, 세로는 top/bottom:0 로 부모 채움
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

  // Kiko wordmark PNG (alpha-mask, 964×411). tintColor swaps it black/white
  // by theme so the same asset works on both light and dark surfaces.
  // marginLeft matches the sectionLabel / historyRow paddingHorizontal so
  // the wordmark sits flush with the '최근 항목' header and the row titles.
  brand: {
    height: 24,
    width: 24 * (964 / 411),
    marginLeft: 12,
    marginTop: 6,
    marginBottom: 24,
  },

  sectionLabel: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    marginBottom: 2,
    paddingHorizontal: 12,
    fontFamily: IOSFont.sans,
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
    fontFamily: IOSFont.sans,
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
    fontFamily: IOSFont.sans,
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
  // Liquid Glass 원형 아바타 — 홈 컴포저와 같은 언어이되 살짝 작게 (50pt)
  // 로 사이드바 하단에 자연스럽게 얹힘.
  avatarBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  avatarText: {
    fontWeight: "400",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    letterSpacing: -0.3,
  },

  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    height: 50,
    borderRadius: 999,
    overflow: "hidden",
  },
  newChatText: {
    ...IOSText.body,
    fontWeight: "400",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
});
