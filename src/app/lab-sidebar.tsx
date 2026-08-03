/**
 * [v1.2 시안] 사이드바 — 내비 허브. 2026-08-04 최종 확정본.
 *
 * 구성: 메뉴 = [Explore] [뉴스] 둘뿐 (동급 표면만, replace 전환) + 최근
 * 항목(스레드 → chat-lab) + [설정 ›](드릴다운이라 유일하게 디스클로저) +
 * [새 채팅](블랙 필 → 빈 Chat). 확정 근거:
 *  - Chat 행 없음 — 대화는 목적지가 아니라 행위 (새 대화 = 컴포저/[새 채팅],
 *    과거 = 최근 항목. GPT/Claude 구조)
 *  - [알림] 행 없음 — 알림함 진입은 메인 상단 벨(빨간 점)이 전담 (중복 제거)
 *  - 빨간 점 뱃지는 벨에만 (HIG 뱃지 절제)
 *
 * 시안은 풀스크린 라우트로 시연 — 실통합 시 기존 sidebar.tsx 슬라이드
 * 드로어 방식 재사용. dev-only, 실서비스 sidebar.tsx 와 별개 파일.
 */
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { Glass, Haptic, IOSColors, IOSFont, IOSText, Opacity, Radius } from '@/theme';

// 구 Spacing 토큰 값 (main Phase 2 dead-code 제거로 theme에서 삭제됨) —
// 다른 lab 화면과 동일하게 프로토타입 로컬로 재도입.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

// ── iOS 27 실측 구조 상수 (docs/apple-blueprints.md, news-lab.tsx와 동일) ──
const LIST_ROW_HEIGHT = 52; // 리스트 행
const GROUP_CARD_RADIUS = 26; // inset grouped 컨테이너 (iOS 26+ 관찰치)
const TOOLBAR_BTN = 36; // 툴바 심볼 버튼 36×36 캡슐
const NEW_CHAT_BTN_HEIGHT = 50; // 버튼 Large 실측
// 하단 고정 블록(설정 행 카드 + 간격 + 새 채팅 필) 높이 근사치 — 스크롤
// 콘텐츠가 이 블록에 가리지 않도록 paddingBottom 계산에 사용.
const BOTTOM_FIXED_BLOCK_HEIGHT =
  LIST_ROW_HEIGHT + Spacing.three + NEW_CHAT_BTN_HEIGHT + Spacing.four;

type MenuItem = {
  id: string;
  label: string;
  route: '/explore-lab' | '/chat-lab' | '/news-lab' | '/notif-inbox-lab';
  showUnreadDot?: boolean;
};

const MENU_ITEMS: MenuItem[] = [
  // Chat 행 없음 (2026-08-03 확정) — 대화는 "가는 곳"이 아니라 기본 행위:
  // 새 대화 = 컴포저/[새 채팅], 과거 대화 = 최근 항목 (GPT/Claude 구조).
  { id: 'explore', label: 'Explore', route: '/explore-lab' },
  // 뉴스 = 데일리 브리핑 방송 채널. 알림함은 메인 상단 벨(뱃지 점)이 전담
  // 진입점 — 사이드바 행은 중복이라 제거 (2026-08-04).
  { id: 'news', label: '뉴스', route: '/news-lab' },
];

// mock 최근 세션 — 실서비스는 listSessions() API, 이 셸은 고정 3개.
const RECENT_SESSIONS = ['여름 원피스 찾아줘', '미니멀 가방 추천', 'Y2K 데님 코디'] as const;

// 디스클로저(›) — news-lab.tsx와 동일: 네이티브는 SF Symbol, 웹은 글리프 폴백.
function Disclosure() {
  return Platform.OS === 'web' ? (
    <Text style={styles.disclosureGlyph}>›</Text>
  ) : (
    <SymbolView name="chevron.right" size={14} tintColor={IOSColors.tertiaryLabel} weight="semibold" />
  );
}

export default function LabSidebarScreen() {
  const insets = useSafeAreaInsets();
  // 웹 미리보기는 safe-area 인셋이 0 → 다이나믹 아일랜드 영역과 겹침.
  // 실기기 상태바 인셋(아이폰 14 Pro 계열 59)을 웹에서만 심는다.
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;
  // 웹 컨테이닝 — 확정 픽셀 폭 (RNW min-content 폭 확장 차단).
  const { width: windowWidth } = useWindowDimensions();

  const handleClose = () => {
    Haptic.light();
    router.back();
  };

  const handleMenuPress = (route: MenuItem['route']) => {
    Haptic.light();
    router.replace(route);
  };

  const handleSessionPress = (title: string) => {
    Haptic.light();
    router.replace((`/chat-lab?display=${encodeURIComponent(title)}`) as never);
  };

  const handleNewChat = () => {
    Haptic.medium();
    // 빈 Chat 으로 (2026-08-03 확정 — 크롬 구분 없이 ‹ 통일. 컴포저 발화와의
    // 차이는 UI가 아니라 "탐색 맥락 승계 여부"라는 동작 스펙만).
    router.push({ pathname: '/chat-lab', params: { display: '' } } as never);
  };

  const handleSettings = () => {
    Haptic.light();
    router.push('/notif-settings-lab');
  };

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      {/* 닫기 — 상단 좌측 글래스 필 36 (news-lab 툴바 문법과 동일). */}
      <View style={[styles.floatingBar, { top: topInset + Spacing.one }]}>
        <Pressable
          hitSlop={8}
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        >
          <GlassSurface {...Glass.chip} isInteractive style={styles.toolbarPill}>
            {Platform.OS === 'web' ? (
              <Text style={styles.closeGlyph}>✕</Text>
            ) : (
              <SymbolView name="xmark" size={15} tintColor={IOSColors.label} weight="medium" />
            )}
          </GlassSurface>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topInset + TOOLBAR_BTN + Spacing.four,
            paddingBottom: insets.bottom + BOTTOM_FIXED_BLOCK_HEIGHT + Spacing.four,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── 워드마크 자리 (임시) ── */}
        <Text style={styles.wordmark}>kiko</Text>

        {/* ── 메뉴 섹션: Explore / Chat / 뉴스 — 허브 레벨 전환, 디스클로저 없음 ── */}
        <View style={styles.groupCard}>
          {MENU_ITEMS.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <View style={styles.rowSeparator} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => handleMenuPress(item.route)}
                style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
              >
                <Text style={styles.listRowTitle} numberOfLines={1}>
                  {item.label}
                </Text>
                <View style={styles.trailingSlot}>
                  {item.showUnreadDot && (
                    <View
                      style={styles.unreadDot}
                      accessibilityLabel="읽지 않은 소식 있음"
                    />
                  )}
                </View>
              </Pressable>
            </View>
          ))}
        </View>

        {/* ── 최근 항목 ── */}
        <Text style={styles.sectionHeader}>최근 항목</Text>
        <View style={styles.groupCard}>
          {RECENT_SESSIONS.map((title, i) => (
            <View key={title}>
              {i > 0 && <View style={styles.rowSeparator} />}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={title}
                onPress={() => handleSessionPress(title)}
                style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
              >
                <Text style={styles.listRowTitle} numberOfLines={1}>
                  {title}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* ── 하단 고정: 설정(드릴다운, 디스클로저) → 새 채팅(필, 가장 아래) ── */}
      <View style={[styles.bottomFixed, { paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.groupCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="설정"
            onPress={handleSettings}
            style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
          >
            <Text style={styles.listRowTitle} numberOfLines={1}>
              설정
            </Text>
            <Disclosure />
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새 채팅"
          onPress={handleNewChat}
          style={({ pressed }) => [styles.newChatBtn, pressed && styles.pressedDim]}
        >
          <Text style={styles.newChatText}>새 채팅</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // inset grouped 페이지 — 배경 grouped Primary, 카드 흰색. (news-lab.tsx와 동일)
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: IOSColors.systemGroupedBackground,
  },

  // ── 플로팅 글래스 컨트롤 ──
  floatingBar: {
    position: 'absolute',
    left: Spacing.three,
    zIndex: 1,
  },
  toolbarPill: {
    width: TOOLBAR_BTN,
    height: TOOLBAR_BTN,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  closeGlyph: {
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
  },

  wordmark: {
    ...IOSText.title3,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginLeft: Spacing.three,
    marginBottom: Spacing.five,
  },

  // ── 섹션 ──
  sectionHeader: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginLeft: Spacing.three,
    marginTop: Spacing.five,
    marginBottom: Spacing.one,
  },

  // inset grouped 카드 — 한 섹션 = 한 덩어리, 행은 헤어라인으로 구분.
  groupCard: {
    backgroundColor: IOSColors.systemBackground,
    borderRadius: GROUP_CARD_RADIUS,
    overflow: 'hidden',
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOSColors.separator,
    marginLeft: Spacing.three,
  },
  rowPressed: {
    backgroundColor: IOSColors.systemGray5,
  },

  // ── 행 (52pt 실측 — LIST_ROW_HEIGHT) ──
  listRow: {
    minHeight: LIST_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  listRowTitle: {
    ...IOSText.body,
    flex: 1,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  // 디스클로저 없는 행(메뉴)도 trailing 폭을 맞춰 텍스트 기준선을 정렬 —
  // unread dot 유무와 무관하게 동일 폭 슬롯을 예약한다.
  trailingSlot: {
    width: 14,
    alignItems: 'center',
  },
  // iOS 표준 unread dot — 컬러 필 뱃지가 아니라 8px 점 하나. 색 하나에만
  // 의존하지 않도록(HIG Color) 행 텍스트("뉴스")가 이미 의미를 전달하고,
  // 점은 "새 소식 있음"의 보조 신호일 뿐이라 접근성 라벨을 별도로 붙였다.
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemRed,
  },
  disclosureGlyph: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '600',
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },

  // ── 하단 고정 블록 ──
  bottomFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  newChatBtn: {
    height: NEW_CHAT_BTN_HEIGHT,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  newChatText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },

  pressedDim: {
    opacity: Opacity.softened,
  },
});
