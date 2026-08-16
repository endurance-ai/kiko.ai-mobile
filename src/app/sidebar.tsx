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
import Constants from "expo-constants";

import { GlassSurface } from "@/components/glass-surface";
import { Haptic, IOSColors, IOSFont, IOSText, Opacity , Radius , withAlpha , Scrim } from "@/theme";
import { ApiError } from "@/lib/api";
import { chatDisplayText } from "@/lib/anchor";
import { deleteSession, listSessions, renameSession } from "@/lib/chat";
import { getMe } from "@/lib/me";
import { stripFamilyName } from "@/lib/name";
import { useAuth } from "@/state/auth";
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
  const { status: authStatus } = useAuth();
  const isGuest = authStatus !== "authenticated";

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
      // 새 채팅 = 빈 챗 화면(인트로 인사말) 으로. Explore(큐레이션)와 구분.
      setTimeout(() => router.replace("/home?chat=1" as never), 30);
    });
  };

  // Explore — 앱 첫 진입에서 보는 큐레이션(메인 /home). 최근 대화(세션)와
  // 구분되는 상시 메뉴 항목. 홈으로 replace 해 큐레이션 표면으로 되돌린다.
  const goExplore = () => {
    Haptic.light();
    animateClose(() => {
      router.back();
      setTimeout(() => router.replace("/home" as never), 30);
    });
  };

  const goSession = (sessionId: string) => {
    Haptic.light();
    animateClose(() => {
      router.back();
      // Reuse the home surface (top bar + composer) — just hydrate it with
      // the picked session's messages via the ?session= query param.
      // from=history: 이전 채팅 열기 → 홈이 이 세션을 큐레이션 숨김으로 기억.
      setTimeout(
        () => router.replace(`/home?session=${sessionId}&from=history` as never),
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

  const goLogin = () => {
    Haptic.light();
    animateClose(() => {
      router.back();
      setTimeout(() => router.push("/login"), 30);
    });
  };

  const promptRename = useCallback(
    (session: SessionSummary) => {
      const current = chatDisplayText(session.title);
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
      const title = chatDisplayText(session.title) || "제목 없음";
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
            // 가로·세로 모두 라이브 window 값으로 명시 고정 — top/bottom:0 만으론
            // (트랜스페어런트 모달 첫 측정 이슈로) 내부 flex 체인이 높이를 못 받아
            // ScrollView 가 안 잡히고 리스트가 넘치던 문제. 높이를 못 박아 자식
            // flex:1(panelInner→body→ScrollView)이 확실히 바운드되게 한다.
            width: PANEL_W,
            height: window.height,
            transform: [{ translateX: slide }],
          },
        ]}
      >
        {/* transparentModal 안에선 SafeAreaView 상단 인셋이 첫 열림 0 / 재열림
            ~59 로 들쭉날쭉해 이중 패딩(마진 튐)이 생긴다 → 상단 edge 는 끄고,
            상태바 여백은 expo-constants 로 일관되게 하나만 준다. */}
        <SafeAreaView edges={[]} style={styles.panelInner}>
          <View
            style={[styles.body, { paddingTop: Constants.statusBarHeight + 8 }]}
          >
            <ExpoImage
              source={WORDMARK_SOURCE}
              style={[styles.brand, { tintColor: wordmarkTint }]}
              contentFit="contain"
              cachePolicy="memory-disk"
              transition={0}
            />

            {/* Explore — 큐레이션(메인) 진입. 최근 대화 목록 위에 상시 노출되는
                동급 메뉴로, '최근 항목' 섹션과 구분한다. */}
            <Pressable
              style={({ pressed }) => [
                styles.menuRow,
                pressed && styles.historyRowActive,
              ]}
              onPress={goExplore}
              accessibilityRole="button"
              accessibilityLabel="Explore"
            >
              <Text style={styles.menuRowText}>Explore</Text>
            </Pressable>

            <Text style={styles.sectionLabel}>최근 항목</Text>

            {sessions === null ? (
              <View style={styles.listLoading}>
                <ActivityIndicator />
              </View>
            ) : sessions.length === 0 ? (
              isGuest ? (
                <View style={styles.emptyGuestBlock}>
                  <Text style={styles.emptyGuestHint}>
                    로그인하면 대화 내역이{"\n"}이곳에 저장돼요
                  </Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.emptyGuestBtn,
                      pressed && styles.emptyGuestBtnPressed,
                    ]}
                    onPress={goLogin}
                    accessibilityLabel="로그인"
                  >
                    <Text style={styles.emptyGuestBtnText}>Log in</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.emptyHint}>아직 대화가 없어요</Text>
              )
            ) : (
              <ScrollView
                style={styles.historyScroll}
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
                        {chatDisplayText(s.title) || "제목 없음"}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </SafeAreaView>

        {/* 하단 버튼 클러스터는 패널 안에 절대 위치로 얹어, 그 뒤로 세션
            리스트가 스크롤돼 지나가면서 글래스 아바타에 자연스럽게 비침.
            게스트 상태에선 프로필 아바타는 숨기지만 "새 채팅"은 유지. */}
        <SafeAreaView edges={["bottom"]} style={styles.bottomSafe}>
          <View style={styles.bottomRow}>
            {!isGuest && (
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
            )}

            <Pressable style={styles.newChatBtn} onPress={goNewChat}>
              <SymbolView
                name="plus"
                size={18}
                tintColor={IOSColors.systemBackground}
                weight="bold"
              />
              <Text style={styles.newChatText}>새 채팅</Text>
            </Pressable>
          </View>
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
    backgroundColor: withAlpha('#000000', Scrim.standard),
  },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: IOSColors.systemBackground,
    shadowColor: "#000",
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 16,
    // Drawer panel 은 세로 화면 전체(~800px)를 채우는 큰 컨테이너 — 50 은
    // 부분 라운드 의도. Radius 스케일에 없는 특수값이라 로컬 유지 (Rule of
    // Three 미달, 다른 데서 재사용 없음). Phase 3-c 획일 반올림에서 pill 로
    // 잘못 매핑돼 캡슐형으로 변형된 것 원복.
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

  // Explore 메뉴 행 — historyRow 와 같은 리듬(12/12, Radius.lg)이되, 최근
  // 대화보다 상위 동급 항목이라 살짝 강조(Semibold). 아래 '최근 항목'
  // 섹션 라벨과 여백으로 구분된다.
  menuRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    marginBottom: 12,
  },
  menuRowText: {
    ...IOSText.body,
    fontWeight: "600",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
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

  // ScrollView 자체는 flex:1 로 남은 높이를 잡아야 스크롤된다. (없으면 콘텐츠
  // 크기대로 늘어나 세션이 많을 때 화면 밖으로 넘치고 하단 버튼과 겹침.)
  historyScroll: { flex: 1 },
  historyList: {
    // 하단 버튼이 절대 위치로 얹혀 있으므로, 리스트 끝이 버튼에 안 가리도록
    // 버튼 클러스터 높이 (∼ 50 + safeArea + row padding) 만큼 여유 확보.
    paddingBottom: 96,
  },
  historyRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: Radius.lg,
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

  // 패널 하단에 절대 위치로 얹혀, 그 뒤로 세션 리스트가 지나갈 수 있도록.
  // Liquid Glass 아바타에 리스트 아이템이 자연스럽게 비침.
  bottomSafe: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
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
    // 50×50 원형 아바타 — 25 는 완전 원 목적. Radius.pill 사용.
    borderRadius: Radius.pill,
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

  // 게스트 하단 로그인 — 원형 dot + 얇은 "Log in" 텍스트, 갭 좁게.
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  // 게스트 상태 아바타 자리에 얹히는 아주 연한 회색 원형 (물음표 없음).
  guestAvatarDot: {
    width: 50,
    height: 50,
    // 50×50 원형 아바타 dot — 완전 원 목적. Radius.pill.
    borderRadius: Radius.pill,
    backgroundColor: "#D8D8DA",
  },
  loginLabel: {
    ...IOSText.body,
    fontWeight: "400",
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    letterSpacing: -0.2,
  },

  // 최근 항목 empty state (게스트) — 남은 세로 공간을 채워 수직 중앙정렬.
  // 게스트 상태에선 하단 버튼 클러스터가 숨겨지므로 별도 offset 불필요.
  emptyGuestBlock: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 16,
  },
  emptyGuestHint: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    textAlign: "center",
    fontFamily: IOSFont.sans,
    lineHeight: 18,
  },
  // 새 채팅 버튼과 언어 통일 — 배경은 IOSColors.label (라이트: 검정, 다크: 흰색)
  // + IOSColors.systemBackground 텍스트. 크기만 empty state 성격에 맞게 살짝 작게.
  emptyGuestBtn: {
    paddingHorizontal: 22,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyGuestBtnPressed: {
    opacity: Opacity.nearFull,
  },
  emptyGuestBtnText: {
    ...IOSText.body,
    fontWeight: "400",
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },

  newChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    height: 50,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
  },
  newChatText: {
    ...IOSText.body,
    fontWeight: "400",
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
});
