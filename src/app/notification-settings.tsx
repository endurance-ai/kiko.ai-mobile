/**
 * 알림 설정 — inset grouped 토글 5섹션 (마스터 / 상품 / 브랜드 / 뉴스 / 기타).
 *
 * ⚠️ 현재 로컬 상태 목업으로 UI 프리뷰. 실서비스는 GET/PATCH /v1/me/notifications
 * (NotificationCategories) 배선 예정 — 매핑: 알림허용→system · 세일→price_drop ·
 * 재입고→restock · 브랜드소식→brand_new_product · 마케팅→release_alerts.
 * 데일리 브리핑은 서버 카테고리 키 부재(뉴스 트랙, 백엔드 신설 대기).
 *
 * 기준: .claude/skills/apple-hig → docs/apple-blueprints.md → notifications.tsx (Switch 패턴)
 */
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
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
import { trackEvent } from '@/lib/analytics';
import { getNotifications, updateNotifications } from '@/lib/devices';
import type { NotificationCategories } from '@/types/api';
import { Glass, Haptic, IOSColors, IOSFont, IOSText, Opacity, Radius } from '@/theme';

// 실 서버 카테고리는 3개(system·release_alerts·taste_push)뿐 — 이 화면의 6개
// 토글 중 '알림 허용'=system, '마케팅, 이벤트'=release_alerts 만 GET/PATCH
// /v1/me/notifications 로 실 배선한다(구 notifications.tsx 로직 승계). 나머지
// (세일·재입고·브랜드 소식·데일리 브리핑)는 서버 카테고리 부재로 로컬 목업 —
// 백엔드 신설 시 배선. 브랜드 팔로우 관리는 팔로우 API 부재로 보류(행 제거).
function readEnabled(cat: NotificationCategories): boolean {
  return cat.system !== false; // null/undefined → 기본 on
}
function readMarketing(cat: NotificationCategories): boolean {
  return cat.release_alerts === true; // 명시적 true 일 때만 on
}

const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

// ── iOS 27 실측 구조 상수 (docs/apple-blueprints.md) ──
const LIST_ROW_HEIGHT = 52;
const GROUP_CARD_RADIUS = 26; // inset grouped 컨테이너 (iOS 26+)
const TOOLBAR_BTN = 36;

// notifications.tsx와 동일 패턴 — trackColor 명시 지정.
const SWITCH_TRACK_COLOR = { false: IOSColors.systemGray4, true: IOSColors.systemGreen };

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

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;
  const { width: windowWidth } = useWindowDimensions();

  // 실 배선 토글(서버 저장) — 기본값은 서버 기본과 동일(system on, marketing off)
  // 이라 로드 전에도 깜빡임 없이 맞다. 로드되면 실제 값으로 갱신.
  const [masterEnabled, setMasterEnabled] = useState(true);
  const [marketing, setMarketing] = useState(false);
  // 로컬 목업 토글(서버 카테고리 부재) — 백엔드 신설 시 배선.
  const [saleAlert, setSaleAlert] = useState(true);
  const [restockAlert, setRestockAlert] = useState(true);
  const [brandNews, setBrandNews] = useState(true);
  const [briefing, setBriefing] = useState(false); // 옵트인 — 기본 OFF, 뉴스 탭 온보딩에서 제안

  // 서버 옵트인 로드 (GET /v1/me/notifications) — 실 2토글만 반영.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getNotifications();
        if (cancelled) return;
        setMasterEnabled(readEnabled(res.categories));
        setMarketing(readMarketing(res.categories));
      } catch {
        // 401/네트워크 — 기본값 유지, 토글은 계속 조작 가능.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 바뀐 키만 PATCH — 다른 카테고리(taste_push 등)를 덮지 않는다.
  const persist = useCallback(async (patch: NotificationCategories) => {
    try {
      await updateNotifications(patch);
    } catch {
      // silent — 로컬 상태가 이미 의도를 반영.
    }
  }, []);

  // 마스터(알림 허용)=system. 켜려면 iOS 권한 필요(미결정이면 요청, 거부돼
  // 있으면 설정 앱 딥링크), 끌 땐 서버 상태만 반영. (구 notifications.tsx 승계)
  const onMasterChange = async (v: boolean) => {
    Haptic.light();
    if (!v) {
      setMasterEnabled(false);
      void persist({ system: false });
      return;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') {
      setMasterEnabled(true);
      void persist({ system: true });
      return;
    }
    if (current.status === 'undetermined' || current.canAskAgain) {
      const next = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      if (next.status === 'granted') {
        setMasterEnabled(true);
        void persist({ system: true });
      }
      return;
    }
    Alert.alert('알림 권한이 필요해요', 'iOS 설정에서 키코 앱의 알림을 켜 주세요.', [
      { text: '취소', style: 'cancel' },
      { text: '설정 열기', onPress: () => void Linking.openSettings() },
    ]);
  };

  // 마케팅=release_alerts. 마스터와 동일한 iOS 권한 흐름 + 가입 트래킹.
  const onMarketingChange = async (v: boolean) => {
    Haptic.light();
    trackEvent('notification_signup_tap', { tapped: v });
    if (!v) {
      setMarketing(false);
      void persist({ release_alerts: false });
      return;
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.status === 'granted') {
      setMarketing(true);
      void persist({ release_alerts: true });
      trackEvent('notification_signup_complete', { contact_type: 'push' });
      return;
    }
    if (current.status === 'undetermined' || current.canAskAgain) {
      const next = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
      if (next.status === 'granted') {
        setMarketing(true);
        void persist({ release_alerts: true });
        trackEvent('notification_signup_complete', { contact_type: 'push' });
      }
      return;
    }
    Alert.alert('알림 권한이 필요해요', 'iOS 설정에서 키코 앱의 알림을 켜 주세요.', [
      { text: '취소', style: 'cancel' },
      { text: '설정 열기', onPress: () => void Linking.openSettings() },
    ]);
  };

  const handleBack = () => {
    Haptic.light();
    router.back();
  };

  const dimmed = !masterEnabled;

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      {/* 플로팅 글래스 컨트롤 — 뒤로가기 = 툴바 36 캡슐. */}
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
        {/* ── 섹션 1 (헤더 없음): 마스터 토글 ── */}
        <View style={styles.groupCard}>
          <ToggleRow
            first
            label="알림 허용"
            value={masterEnabled}
            onValueChange={onMasterChange}
          />
        </View>

        {/* ── 섹션 2: 상품 알림 — 마스터 OFF 시 dim + 상호작용 차단 ── */}
        <View style={dimmed ? styles.dimmed : undefined} pointerEvents={dimmed ? 'none' : 'auto'}>
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
        <View style={dimmed ? styles.dimmed : undefined} pointerEvents={dimmed ? 'none' : 'auto'}>
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
          </View>
          <Text style={styles.sectionFooter}>팔로우한 브랜드의 세일, 신상 소식이에요</Text>
        </View>

        {/* ── 섹션 4: 뉴스 — 데일리 브리핑 (옵트인, 뉴스 탭 온보딩과 연동) ── */}
        <View style={dimmed ? styles.dimmed : undefined} pointerEvents={dimmed ? 'none' : 'auto'}>
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
        <View style={dimmed ? styles.dimmed : undefined} pointerEvents={dimmed ? 'none' : 'auto'}>
          <Text style={styles.sectionHeader}>기타</Text>
          <View style={styles.groupCard}>
            <ToggleRow
              first
              label="마케팅, 이벤트"
              value={marketing}
              disabled={dimmed}
              onValueChange={onMarketingChange}
            />
          </View>
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
  dimmed: {
    opacity: Opacity.faint,
  },
});
