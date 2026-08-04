/**
 * [알림 트랙 시안] 브랜드 소식 전체 리스트 — dev-only, 내비게이션 연결 금지,
 * 커밋 전 사용자 확정 필요.
 *
 * 브랜드 홈의 "최근 소식 ›" 헤더(애플뮤직 섹션 타이틀 문법)를 탭하면 푸시되는
 * 드릴다운 리스트. 구성 = 플로팅 ‹ + 중앙 내비 타이틀("최근 소식") + inset
 * grouped 카드 리스트 (news-lab 행 문법 그대로).
 *
 * 기준: .claude/skills/apple-hig(규범) → docs/apple-blueprints.md(치수) →
 *       docs/design-system.md(토큰). 행 문법·상수는 news-lab 캐논 재사용.
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

// 구 Spacing 토큰 값 — 다른 lab 화면과 동일하게 로컬 재도입.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

// iOS 27 실측 구조 상수 (docs/apple-blueprints.md)
const GROUP_CARD_RADIUS = 26;
const TOOLBAR_BTN = 36;

// mock — 실서비스는 GET /v1/brands/:id/news (페이지네이션).
// 알림 문안 체계 기반 (2026-08-04): 항목 = 알림 이벤트와 동일 소스·동일 문안.
// 세일 = 2줄(제목 + 최대 N% 싸요), 신상 = 1줄. 룩북 등 비수치 소식은 제외
// (알림 기반 = 수치 이벤트만 — 비수치는 2단계 별도).
const ALL_NEWS = [
  { id: 'n1', message: '제이디드 런던 세일 시작했어요', sub: '최대 40% 싸요', relativeTime: '2시간 전' },
  { id: 'n2', message: '제이디드 런던에 신상 12개가 들어왔어요', sub: null, relativeTime: '3일 전' },
  { id: 'n3', message: '제이디드 런던 세일이 끝났어요', sub: '다음 세일을 지켜볼게요', relativeTime: '3주 전' },
  { id: 'n4', message: '제이디드 런던에 신상 8개가 들어왔어요', sub: null, relativeTime: '1달 전' },
] as const;

export default function BrandNewsLabScreen() {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  // 웹 미리보기 safe-area 심 (다른 lab 과 동일).
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;

  const handleBack = () => {
    Haptic.light();
    router.back();
  };

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      {/* 플로팅 바 — ‹(드릴다운) + 중앙 내비 타이틀 (뉴스 탭과 동일 문법) */}
      <View style={[styles.floatingBar, { top: topInset + Spacing.one }]}>
        <View pointerEvents="none" style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>최근 소식</Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <GlassSurface {...Glass.chip} isInteractive style={styles.toolbarPill}>
            {Platform.OS === 'web' ? (
              <Text style={styles.backGlyph}>‹</Text>
            ) : (
              <SymbolView name="chevron.left" size={17} tintColor={IOSColors.label} weight="medium" />
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
        <View style={styles.groupCard}>
          {ALL_NEWS.map((news, i) => (
            <View key={news.id}>
              {i > 0 && <View style={styles.rowSeparator} />}
              <View style={styles.newsRow}>
                <Text style={styles.newsMessage}>{news.message}</Text>
                {news.sub != null && <Text style={styles.newsSub}>{news.sub}</Text>}
                <Text style={styles.newsTime}>{news.relativeTime}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: IOSColors.systemGroupedBackground,
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
  backGlyph: {
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
  },
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
  newsRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  newsMessage: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  newsSub: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: 1,
  },
  newsTime: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.half,
  },
});
