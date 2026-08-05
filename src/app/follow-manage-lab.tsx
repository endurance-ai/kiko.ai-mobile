/**
 * [알림 트랙 시안] 팔로우 브랜드 관리 — dev-only, 진입 = 알림 설정
 * "팔로우 브랜드 관리 ›" 드릴다운.
 *
 * 역할: 팔로우 브랜드별 알림 on/off + 팔로우 취소. 알림을 꺼도 팔로우는
 * 유지된다(brand_follows.notify_enabled만 변경) — 팔로우/알림 분리 원칙.
 *
 * 실서비스 API:
 *   - 목록: GET /v1/me/follows
 *   - 알림 스위치: POST /v1/brands/:id/follow { notify } 갱신
 *   - 팔로우 취소: DELETE /v1/brands/:id/follow
 *
 * 편집 문법: iOS 표준 리스트 편집(마이너스 → 우측 삭제 버튼, 탭으로 확정).
 * 네이티브 전환 시 스와이프 삭제(Lists/Slide Action)를 병행 검토할 것 —
 * 지금은 웹 프리뷰 호환을 위해 탭 기반으로만 구현.
 *
 * 기준 체인: .claude/skills/apple-hig(규범) → docs/apple-blueprints.md(치수) →
 *            src/app/notif-settings-lab.tsx(디자인 문법 캐논).
 */
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
import { Glass, Haptic, IOSColors, IOSFont, IOSText, Radius } from '@/theme';

// 구 Spacing 토큰 값 — 다른 lab 화면과 동일하게 로컬 재도입.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

// ── iOS 27 실측 구조 상수 (docs/apple-blueprints.md, notif-settings-lab.tsx와 동일) ──
const LIST_ROW_HEIGHT = 52; // 리스트 행
const GROUP_CARD_RADIUS = 26; // inset grouped 컨테이너
const TOOLBAR_BTN = 36; // 툴바 심볼/텍스트 버튼 높이
const MINUS_SIZE = 22; // 편집 모드 leading 마이너스 원

// notif-settings-lab.tsx와 동일 패턴 — trackColor 명시 지정.
const SWITCH_TRACK_COLOR = { false: IOSColors.systemGray4, true: IOSColors.systemGreen };

// mock — 실서비스는 GET /v1/me/follows.
type FollowBrand = { id: string; name: string; notify: boolean };
const INITIAL_BRANDS: FollowBrand[] = [
  { id: 'b1', name: '제이디드 런던', notify: true },
  { id: 'b2', name: '마지셔우드', notify: true },
  { id: 'b3', name: '마뗑킴', notify: false },
  { id: 'b4', name: 'OPEN YY', notify: true },
  { id: 'b5', name: 'slowand', notify: false },
  { id: 'b6', name: 'depound', notify: true },
];

// 편집 모드 leading 마이너스 — 네이티브는 SF Symbol, 웹은 View 폴백(이모지/유니코드 금지).
function MinusCircle() {
  return Platform.OS === 'web' ? (
    <View style={styles.minusCircle}>
      <View style={styles.minusBar} />
    </View>
  ) : (
    <SymbolView name="minus.circle.fill" size={MINUS_SIZE} tintColor={IOSColors.systemRed} />
  );
}

function FollowRow({
  brand,
  editMode,
  isOpen,
  first,
  onToggleNotify,
  onToggleMinus,
  onUnfollow,
}: {
  brand: FollowBrand;
  editMode: boolean;
  isOpen: boolean;
  first?: boolean;
  onToggleNotify: (v: boolean) => void;
  onToggleMinus: () => void;
  onUnfollow: () => void;
}) {
  return (
    <View>
      {!first && <View style={styles.rowSeparator} />}
      <View style={styles.listRow}>
        {editMode && (
          <Pressable
            hitSlop={8}
            onPress={() => {
              Haptic.light();
              onToggleMinus();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${brand.name} 편집`}
          >
            <MinusCircle />
          </Pressable>
        )}
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {brand.name}
        </Text>
        {!editMode && (
          <Switch
            value={brand.notify}
            onValueChange={(v) => {
              Haptic.light();
              onToggleNotify(v);
            }}
            trackColor={SWITCH_TRACK_COLOR}
            accessibilityRole="switch"
            accessibilityLabel={`${brand.name} 알림`}
            style={styles.switchTrailing}
          />
        )}
      </View>
      {editMode && isOpen && (
        <Pressable
          onPress={() => {
            Haptic.light();
            onUnfollow();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${brand.name} 팔로우 취소`}
          style={styles.deleteButton}
        >
          <Text style={styles.deleteButtonText}>팔로우 취소</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function FollowManageLabScreen() {
  const insets = useSafeAreaInsets();
  // 웹 미리보기는 safe-area 인셋이 0 → 다이나믹 아일랜드 영역과 겹침.
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;
  const { width: windowWidth } = useWindowDimensions();

  const [brands, setBrands] = useState<FollowBrand[]>(INITIAL_BRANDS);
  const [editMode, setEditMode] = useState(false);
  const [openDeleteId, setOpenDeleteId] = useState<string | null>(null);

  const isEmpty = brands.length === 0;

  const handleBack = () => {
    Haptic.light();
    router.back();
  };

  const handleToggleEdit = () => {
    Haptic.light();
    setEditMode((prev) => !prev);
    setOpenDeleteId(null);
  };

  const handleToggleMinus = (id: string) => {
    setOpenDeleteId((prev) => (prev === id ? null : id));
  };

  const handleToggleNotify = (id: string, v: boolean) => {
    setBrands((prev) => prev.map((b) => (b.id === id ? { ...b, notify: v } : b)));
  };

  const handleUnfollow = (id: string) => {
    setOpenDeleteId(null);
    setBrands((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (next.length === 0) {
        setEditMode(false);
      }
      return next;
    });
  };

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      {/* 플로팅 글래스 컨트롤 — notif-settings-lab.tsx와 동일 문법. */}
      <View style={[styles.floatingBar, { top: topInset + Spacing.one }]}>
        <View pointerEvents="none" style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>팔로우 브랜드</Text>
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

        {!isEmpty && (
          <Pressable
            hitSlop={8}
            onPress={handleToggleEdit}
            accessibilityRole="button"
            accessibilityLabel={editMode ? '완료' : '편집'}
          >
            <GlassSurface {...Glass.chip} isInteractive style={styles.editButtonPill}>
              <Text style={[styles.editButtonText, editMode && styles.editButtonTextDone]}>
                {editMode ? '완료' : '편집'}
              </Text>
            </GlassSurface>
          </Pressable>
        )}
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
        {isEmpty ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>팔로우한 브랜드가 없어요</Text>
            <Text style={styles.emptySubtitle}>브랜드 홈에서 팔로우하면 여기에 보여요</Text>
          </View>
        ) : (
          <>
            <View style={styles.groupCard}>
              {brands.map((brand, i) => (
                <FollowRow
                  key={brand.id}
                  brand={brand}
                  first={i === 0}
                  editMode={editMode}
                  isOpen={openDeleteId === brand.id}
                  onToggleNotify={(v) => handleToggleNotify(brand.id, v)}
                  onToggleMinus={() => handleToggleMinus(brand.id)}
                  onUnfollow={() => handleUnfollow(brand.id)}
                />
              ))}
            </View>
            <Text style={styles.sectionFooter}>알림을 꺼도 팔로우는 유지돼요</Text>
          </>
        )}
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

  // ── 플로팅 글래스 컨트롤 ──
  floatingBar: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  editButtonPill: {
    height: TOOLBAR_BTN,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  editButtonText: {
    ...IOSText.body,
    fontFamily: IOSFont.sans,
    fontWeight: '500',
    color: IOSColors.systemBlue,
  },
  editButtonTextDone: {
    fontWeight: '600',
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

  sectionFooter: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    marginLeft: Spacing.three,
    marginTop: Spacing.one,
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

  // 편집 모드 leading 마이너스 — 웹 폴백 (네이티브는 SF minus.circle.fill).
  minusCircle: {
    width: MINUS_SIZE,
    height: MINUS_SIZE,
    borderRadius: MINUS_SIZE / 2,
    backgroundColor: IOSColors.systemRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  minusBar: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },

  // 편집 모드 trailing 삭제 버튼 — Lists/Rows/Editing/Delete 25×52 문법,
  // 행 우측 전체 높이를 덮는다(Lists/Slide Action과 동일 시맨틱, 탭 기반 구현).
  deleteButton: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    backgroundColor: IOSColors.systemRed,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  deleteButtonText: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    color: '#FFFFFF',
    fontFamily: IOSFont.sans,
  },

  // ── 빈 상태 ──
  emptyState: {
    marginTop: Spacing.six + Spacing.five, // 크게 — 96
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  emptyTitle: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
