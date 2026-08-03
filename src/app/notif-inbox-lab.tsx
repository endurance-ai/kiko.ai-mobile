/**
 * [알림 트랙 시안] 알림 — 개인 소식함 (뉴스와 분리된 별도 탭, 2026-08-04 확정)
 * dev-only, 내비게이션 연결 금지, 커밋 전 사용자 확정 필요.
 *
 * 역할: 찜 세일·재입고 + 팔로우 브랜드 소식의 유저별 아카이브 = "놓친 푸시의
 * 영수증". 발송 배치가 푸시와 동시에 적재하는 user_notifications 를 그대로
 * 리스트로. 행 탭 → PDP/브랜드 홈 (mock). 인스타/무신사 벨 알림함 관례.
 * 뉴스(데일리 브리핑 방송 채널)와 혼류하지 않음 — 브리핑은 모두 동일,
 * 여긴 나만의 것.
 *
 * IA: 동급 표면 (사이드바 [알림], 빨간 점은 여기에만 — HIG 뱃지 절제) → ☰.
 * 기준: .claude/skills/apple-hig → docs/apple-blueprints.md → design-system.md
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
import { Glass, Haptic, IOSColors, IOSFont, IOSText, Radius } from '@/theme';

const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
const TOOLBAR_BTN = 36;
const LIST_ROW_HEIGHT = 52; // iOS 27 리스트 행 실측

// mock — 실서비스는 GET /v1/notifications (유저별, 발송 배치 적재분).
// 가격 하락 문안 (2026-08-04 확정): "찜하신 [브랜드명] 상품이 할인되었어요"
// + 기존가 → 현재가 별도 라인 (취소선은 리스트에선 텍스트로, 상세에선 스타일로).
const INBOX = [
  { id: 'n1', text: '찜하신 slowand 상품이 할인되었어요', oldPrice: '89,000원', newPrice: '72,900원', sub: null, time: '2시간 전', unread: true },
  { id: 'n2', text: '팔로우한 마지셔우드 세일 시작했어요', oldPrice: null, newPrice: null, sub: '최대 40% 싸요', time: '오전 11:40', unread: true },
  { id: 'n3', text: '찜한 Y2K 탑이 재입고되었어요', oldPrice: null, newPrice: null, sub: null, time: '어제', unread: false },
  { id: 'n4', text: '마뗑킴에 신상 12개가 들어왔어요', oldPrice: null, newPrice: null, sub: null, time: '어제', unread: false },
  { id: 'n5', text: '찜하신 depound 상품이 할인되었어요', oldPrice: '54,000원', newPrice: '47,500원', sub: null, time: '3일 전', unread: false },
  { id: 'n6', text: '팔로우한 OPEN YY 세일 시작했어요', oldPrice: null, newPrice: null, sub: '최대 30% 싸요', time: '1주 전', unread: false },
] as const;

export default function NotifInboxLabScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;
  const { width: windowWidth } = useWindowDimensions();

  const handleOpenSidebar = () => {
    Haptic.light();
    router.push('/lab-sidebar' as never);
  };

  const handleRowPress = () => {
    Haptic.selection(); // mock — 실서비스는 소식 대상(PDP/브랜드 홈)으로 push.
  };

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      <View style={[styles.floatingBar, { top: topInset + Spacing.one }]}>
        <View pointerEvents="none" style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>알림</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={handleOpenSidebar}
          accessibilityRole="button"
          accessibilityLabel="메뉴"
        >
          <GlassSurface {...Glass.chip} isInteractive style={styles.toolbarPill}>
            {Platform.OS === 'web' ? (
              <Text style={styles.menuGlyph}>☰</Text>
            ) : (
              <SymbolView name="line.3.horizontal" size={18} tintColor={IOSColors.label} weight="medium" />
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
            paddingBottom: insets.bottom + Spacing.six,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {INBOX.map((n, i) => (
          <View key={n.id}>
            {i > 0 && <View style={styles.rowSeparator} />}
            <Pressable
              accessibilityRole="button"
              onPress={handleRowPress}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              {/* 미확인 점 — 행 좌측 (iOS 메일 관례), 확인 시 사라짐 */}
              <View style={[styles.unreadDot, !n.unread && styles.unreadDotHidden]} />
              <View style={styles.rowBody}>
                <Text style={[styles.rowText, !n.unread && styles.rowTextRead]}>{n.text}</Text>
                {/* 할인: 기존가 취소선 + 현재가 (SSENSE 타일 문법과 통일) */}
                {n.oldPrice != null && (
                  <Text style={styles.rowPrice}>
                    <Text style={styles.rowPriceOld}>{n.oldPrice}</Text>
                    {'  '}
                    {n.newPrice}
                  </Text>
                )}
                {n.sub != null && <Text style={styles.rowPrice}>{n.sub}</Text>}
                <Text style={styles.rowTime}>{n.time}</Text>
              </View>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: IOSColors.systemBackground,
  },
  floatingBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  navTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  navTitle: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  toolbarPill: {
    width: TOOLBAR_BTN,
    height: TOOLBAR_BTN,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  menuGlyph: {
    fontSize: 17,
    lineHeight: 18,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: IOSColors.separator,
  },
  row: {
    minHeight: LIST_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  rowPressed: {
    backgroundColor: IOSColors.systemGray5,
  },
  // iOS 메일 미확인 점 — 8px systemBlue (메일 관례. 컬러 필 뱃지 아님).
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemBlue,
  },
  unreadDotHidden: {
    opacity: 0,
  },
  rowBody: {
    flex: 1,
  },
  rowText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  rowTextRead: {
    fontWeight: '400',
    color: IOSColors.secondaryLabel,
  },
  rowPrice: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginTop: 1,
  },
  rowPriceOld: {
    color: IOSColors.tertiaryLabel,
    textDecorationLine: 'line-through',
  },
  rowTime: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: 1,
  },
});
