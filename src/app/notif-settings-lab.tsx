// [알림 트랙 시안] — dev-only, 내비게이션 연결 금지, 커밋 전 사용자 확정 필요
// 기준 문서: .claude/skills/apple-hig/SKILL.md → docs/apple-blueprints.md → src/app/news-lab.tsx (디자인 문법 캐논) → src/app/notifications.tsx (Switch 패턴)
//
// 참고: notifications.tsx는 Switch trackColor를 명시 지정한다(off=systemGray4,
// on=systemGreen) — "미지정(플랫폼 기본값)"이 아니라 그 반대다. 이 파일은
// notifications.tsx의 실제 패턴(명시 지정)을 그대로 따른다.
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { Glass, Haptic, IOSColors, IOSFont, IOSText, Opacity, Radius } from '@/theme';

// 구 Spacing 토큰 값 — news-lab.tsx와 동일하게 프로토타입 로컬로 재도입.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

// ── iOS 27 실측 구조 상수 (docs/apple-blueprints.md, news-lab.tsx와 동일) ──
const LIST_ROW_HEIGHT = 52; // 리스트 행
const GROUP_CARD_RADIUS = 26; // inset grouped 컨테이너 (iOS 26+ 관찰치)
const TOOLBAR_BTN = 36; // 툴바 심볼 버튼 36×36 캡슐



// notifications.tsx와 동일 패턴 — trackColor 명시 지정.
const SWITCH_TRACK_COLOR = { false: IOSColors.systemGray4, true: IOSColors.systemGreen };

// 디스클로저(›) — news-lab.tsx와 동일: 네이티브는 SF Symbol, 웹은 글리프 폴백.
function Disclosure() {
  return Platform.OS === 'web' ? (
    <Text style={styles.disclosureGlyph}>›</Text>
  ) : (
    <SymbolView name="chevron.right" size={14} tintColor={IOSColors.tertiaryLabel} weight="semibold" />
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  disabled,
  first,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  first?: boolean;
}) {
  return (
    <View>
      {!first && <View style={styles.rowSeparator} />}
      <View style={styles.listRow}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {label}
        </Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={SWITCH_TRACK_COLOR}
          accessibilityRole="switch"
          accessibilityLabel={label}
          style={styles.switchTrailing}
        />
      </View>
    </View>
  );
}

function DisclosureRow({
  label,
  onPress,
  disabled,
  first,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  first?: boolean;
}) {
  return (
    <View>
      {!first && <View style={styles.rowSeparator} />}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={() => {
          Haptic.light();
          onPress();
        }}
        style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
      >
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {label}
        </Text>
        <Disclosure />
      </Pressable>
    </View>
  );
}

export default function NotifSettingsLabScreen() {
  const insets = useSafeAreaInsets();
  // 웹 미리보기는 safe-area 인셋이 0 → 다이나믹 아일랜드 영역과 겹침.
  // 실기기 상태바 인셋(아이폰 14 Pro 계열 59)을 웹에서만 심는다. (news-lab.tsx와 동일)
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;
  // 웹 컨테이닝 — 확정 픽셀 폭 (RNW min-content 폭 확장 차단).
  const { width: windowWidth } = useWindowDimensions();


  const [masterEnabled, setMasterEnabled] = useState(true);
  const [saleAlert, setSaleAlert] = useState(true);
  const [restockAlert, setRestockAlert] = useState(true);
  const [brandNews, setBrandNews] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [briefing, setBriefing] = useState(false); // 옵트인 — 기본 OFF, 뉴스 탭 온보딩에서 제안

  const handleBack = () => {
    Haptic.light();
    router.back();
  };

  const dimmed = !masterEnabled;

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      {/* 플로팅 글래스 컨트롤 — news-lab.tsx와 동일 문법. 뒤로가기 = 툴바 36 캡슐. */}
      <View style={[styles.floatingBar, { top: topInset + Spacing.one }]}>
        <View pointerEvents="none" style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>알림</Text>
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
        <>
            {/* ── 섹션 1 (헤더 없음): 마스터 토글 ── */}
            <View style={styles.groupCard}>
              <ToggleRow
                first
                label="알림 허용"
                value={masterEnabled}
                onValueChange={(v) => {
                  Haptic.light();
                  setMasterEnabled(v);
                }}
              />
            </View>

            {/* ── 섹션 2: 상품 알림 — 마스터 OFF 시 dim + 상호작용 차단 ── */}
            <View
              style={dimmed ? styles.dimmed : undefined}
              pointerEvents={dimmed ? 'none' : 'auto'}
            >
              <Text style={styles.sectionHeader}>상품 알림</Text>
              <View style={styles.groupCard}>
                <ToggleRow
                  first
                  label="세일 알림"
                  value={saleAlert}
                  disabled={dimmed}
                  onValueChange={(v) => {
                    Haptic.light();
                    setSaleAlert(v);
                  }}
                />
                <ToggleRow
                  label="재입고 알림"
                  value={restockAlert}
                  disabled={dimmed}
                  onValueChange={(v) => {
                    Haptic.light();
                    setRestockAlert(v);
                  }}
                />
              </View>
              <Text style={styles.sectionFooter}>찜한 상품의 소식을 알려드려요</Text>
            </View>

            {/* ── 섹션 3: 브랜드 알림 ── */}
            <View
              style={dimmed ? styles.dimmed : undefined}
              pointerEvents={dimmed ? 'none' : 'auto'}
            >
              <Text style={styles.sectionHeader}>브랜드 알림</Text>
              <View style={styles.groupCard}>
                <ToggleRow
                  first
                  label="브랜드 소식"
                  value={brandNews}
                  disabled={dimmed}
                  onValueChange={(v) => {
                    Haptic.light();
                    setBrandNews(v);
                  }}
                />
                <DisclosureRow
                  label="팔로우 브랜드 관리"
                  disabled={dimmed}
                  onPress={() => {
                    router.push('/follow-manage-lab' as never);
                  }}
                />
              </View>
              <Text style={styles.sectionFooter}>팔로우한 브랜드의 세일, 신상 소식이에요</Text>
            </View>

            {/* ── 섹션 4: 뉴스 — 데일리 브리핑 (옵트인, 뉴스 탭 온보딩과 연동) ── */}
            <View
              style={dimmed ? styles.dimmed : undefined}
              pointerEvents={dimmed ? 'none' : 'auto'}
            >
              <Text style={styles.sectionHeader}>뉴스</Text>
              <View style={styles.groupCard}>
                <ToggleRow
                  first
                  label="데일리 브리핑"
                  value={briefing}
                  disabled={dimmed}
                  onValueChange={(v) => {
                    Haptic.light();
                    setBriefing(v);
                  }}
                />
              </View>
              <Text style={styles.sectionFooter}>매일 아침 패션 소식을 알림으로 보내드려요</Text>
            </View>

            {/* ── 섹션 5: 기타 ── */}
            <View
              style={dimmed ? styles.dimmed : undefined}
              pointerEvents={dimmed ? 'none' : 'auto'}
            >
              <Text style={styles.sectionHeader}>기타</Text>
              <View style={styles.groupCard}>
                <ToggleRow
                  first
                  label="마케팅, 이벤트"
                  value={marketing}
                  disabled={dimmed}
                  onValueChange={(v) => {
                    Haptic.light();
                    setMarketing(v);
                  }}
                />
              </View>
            </View>
        </>
      </ScrollView>
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
    right: Spacing.three,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  // 툴바 심볼 버튼 36×36 캡슐 (blueprints) + hitSlop 8 = 유효 타깃 44+.
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

  // 내비 바 중앙 타이틀 — iOS 표준 (headline 17 semibold).
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

  // ── 섹션 ──
  sectionHeader: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginLeft: Spacing.three,
    marginTop: Spacing.five,
    marginBottom: Spacing.one,
  },
  sectionFooter: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    marginLeft: Spacing.three,
    marginTop: Spacing.one,
  },

  // inset grouped 카드 — 한 섹션 = 한 덩어리, 행은 헤어라인으로 구분. (news-lab.tsx와 동일)
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
  switchTrailing: {
    alignSelf: 'center',
  },
  disclosureGlyph: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '600',
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },

  // 마스터 토글 OFF 시 하위 섹션 dim — Opacity.faint(0.35, "disabled labels" 시맨틱).
  dimmed: {
    opacity: Opacity.faint,
  },
});
