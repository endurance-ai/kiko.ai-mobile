/**
 * [IA 시안 A — 탭바] dev-only, 내비게이션 연결 금지, 커밋 전 사용자 확정 필요
 *
 * 현행(사이드바 허브, GPT/Claude 관례) 대비 A안 — 애플 정통 탭바 비교용 시안.
 * 근거: `.claude/skills/apple-hig` §2.4 "앱의 최상위 섹션 간 이동 → Tab bar,
 * 항상 화면에 보이게 유지" — Explore·뉴스·찜은 서로 동급인 최상위 섹션이라
 * 탭바가 맞는 선택이고, 사이드바(허브)는 그 대안으로 남긴다.
 *
 * 구성 확정 스케치:
 *  - 탭 3개: Explore · 뉴스(미확인 뱃지) · 찜. 탭바는 "이동 전용" —
 *    액션을 얹지 않는다(§2.4 안티패턴: 탭바를 액션 버튼 용도로 쓰지 말 것).
 *  - Chat 은 탭이 아니다 — 탭바 위에 상주하는 글래스 컴포저(뮤직 미니플레이어
 *    자리 문법)에 전송하면 `/chat-lab` 으로 push 한다. 디테일 화면이라
 *    탭바는 그 위에서 숨는다(iOS 표준 — 탭에서 push된 화면은 탭바를 가린다).
 *  - 컴포저를 탭(전송 아님)하면 검색 진입 상태로 확장 — "최근 스레드" 리스트가
 *    뜬다. 이것이 사이드바(히스토리 허브) 폐지의 대안이다: 스레드 목록의 집을
 *    앱스토어 검색 탭·Photos 검색의 "최근 검색" 문법으로 옮긴 것.
 *
 * 기준: `.claude/skills/apple-hig/SKILL.md`(규범) → `docs/apple-blueprints.md`
 * (치수, 아래 주석에 인용) → `src/theme`(토큰). 문법 캐논은 news-lab.tsx
 * (상수·topInset 웹 심·글래스), 콘텐츠 압축은 explore-lab.tsx 참고.
 */
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { ProductCard } from '@/components/product-card';
import { MOCK_PRODUCTS } from '@/state/products';
import { Glass, Haptic, IOSColors, IOSFont, IOSText, Radius, RadiusRole } from '@/theme';

// 구 Spacing 토큰 값 (main Phase 2 dead-code 제거로 theme에서 삭제됨) —
// 다른 lab 화면과 동일하게 프로토타입 로컬로 재도입 (news-lab/explore-lab 관례).
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

// ── iOS 27 실측 구조 상수 (docs/apple-blueprints.md "Tab Bars" 섹션) ────────
// "Tab Bars/iPhone/Tabs - No Search/3 Tabs" 346×62 — 3탭 바 실측 높이(62).
// 인셋(홈 인디케이터)은 그 아래 별도로 insets.bottom 만큼 추가한다.
const TAB_BAR_HEIGHT = 62;
// "Tab Bars/iPhone/Tab - Default/Default" 72×54, 폰트 SFPro-Semibold 10 /
// SFPro-Semibold 18 — 아이템 내부 콘텐츠 높이 54, 라벨 10pt, 아이콘 글리프 18pt.
// (탭 라벨 10pt는 HIG 타이포 "최소 11pt" 권장의 명시적 예외 — 시스템 탭바
// 자체가 caption2급 10pt를 표준으로 쓴다.)
const TAB_ITEM_HEIGHT = 54;
const TAB_ICON_SIZE = 18;
const TAB_LABEL_SIZE = 10;
// 뱃지 — HIG "뱃지는 정말 중요한 정보에만" + 사용자 스펙 8px.
const BADGE_SIZE = 8;
// 컴포저 — home/explore-lab/chat-lab 과 동일 56/44 (2026-07-14 확정 수치).
const COMPOSER_HEIGHT = 56;
const SEND_BTN_SIZE = 44;
// 시트 닫기 버튼 — blueprints "Toolbars/Top (34pt)/Active/Close Button" 34×34.
const CLOSE_BTN_SIZE = 34;
// 그룹 카드/행 — news-lab 과 동일 실측(행 52, 카드 라디우스 26).
const LIST_ROW_HEIGHT = 52;
const GROUP_CARD_RADIUS = 26;

type TabKey = 'explore' | 'news' | 'wishlist';

const TABS: { key: TabKey; label: string; symbol: 'sparkles' | 'bell' | 'heart'; glyph: string }[] = [
  { key: 'explore', label: 'Explore', symbol: 'sparkles', glyph: '✦' },
  { key: 'news', label: '뉴스', symbol: 'bell', glyph: '△' },
  { key: 'wishlist', label: '찜', symbol: 'heart', glyph: '♡' },
];

// ── mock 데이터 (전부 경량 — 실데이터 연동 없음) ────────────────────────────
const EXPLORE_SECTION_LABELS = ['지금 인기 브랜드', 'Under $100'];
const EXPLORE_PRODUCTS = MOCK_PRODUCTS.slice(0, 4);

const NEWS_DIGEST = [
  { id: 'n1', brand: 'MARGESHERWOOD', message: '세일 시작했어요, 최대 40% 싸요' },
  { id: 'n2', brand: 'Matin Kim', message: '신상 12개가 들어왔어요' },
] as const;

const WISHLIST_DIGEST = [
  { id: 'w1', label: '로맨틱 원피스', detail: '18% 내렸어요, 72,900원' },
  { id: 'w2', label: 'Y2K 탑', detail: '재입고되었어요' },
  { id: 'w3', label: '카프리 팬츠', detail: '12% 내렸어요' },
] as const;

const RECENT_THREADS = [
  { id: 't1', title: '여름 원피스 찾아줘' },
  { id: 't2', title: '미니멀 가방 추천' },
  { id: 't3', title: 'Y2K 데님 코디' },
] as const;

export default function TabbarLabScreen() {
  const insets = useSafeAreaInsets();
  // 웹 미리보기는 safe-area 인셋이 0 → 다이나믹 아일랜드 영역과 겹침.
  // 실기기 상태바 인셋(아이폰 14 Pro 계열 59)을 웹에서만 심는다 (news-lab 관례).
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;

  const [tab, setTab] = useState<TabKey>('explore');
  const [composerOpen, setComposerOpen] = useState(false);

  // 탭 전환 — 애니메이션 없이 상태 스왑, selection 햅틱만.
  const handleTabPress = (next: TabKey) => {
    Haptic.selection();
    setTab(next);
  };

  // 상주 컴포저 탭(전송 아님) → 검색 진입 상태로 확장.
  const handleComposerOpen = () => {
    Haptic.light();
    setComposerOpen(true);
  };

  const handleComposerClose = () => {
    Haptic.light();
    setComposerOpen(false);
  };

  // 컴포저 전송 버튼 — Chat 은 탭이 아니라 push 되는 디테일 화면.
  const handleSend = () => {
    Haptic.medium();
    setComposerOpen(false);
    router.push('/chat-lab');
  };

  // "최근" 행 탭 — 해당 스레드를 첫 턴으로 들고 chat-lab 진입.
  const handleRecentPress = (title: string) => {
    Haptic.light();
    setComposerOpen(false);
    router.push({ pathname: '/chat-lab', params: { display: title, query: title } });
  };

  const composerAreaHeight = COMPOSER_HEIGHT + Spacing.two;
  const tabBarTotalHeight = TAB_BAR_HEIGHT + insets.bottom;
  // 콘텐츠가 상주 컴포저 + 탭바에 가리지 않도록 하단 여유 확보.
  const contentBottomPadding = tabBarTotalHeight + composerAreaHeight + Spacing.four;

  return (
    <View style={styles.root}>
      {/* ── 탭 콘텐츠 (경량 mock, 스위치 렌더) ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topInset + Spacing.four, paddingBottom: contentBottomPadding },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 아바타(설정 진입) — 앱스토어 문법: 내비 바 없이 콘텐츠 상단 우측,
            스크롤과 함께 올라감. 세 탭 공통 위치로 일관성 유지. */}
        <View style={styles.avatarRow}>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="프로필 및 설정"
            onPress={() => {
              Haptic.light();
              router.push('/notif-settings-lab');
            }}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>현</Text>
            </View>
          </Pressable>
        </View>
        {tab === 'explore' && <ExploreTabContent />}
        {tab === 'news' && <NewsTabContent />}
        {tab === 'wishlist' && <WishlistTabContent />}
      </ScrollView>

      {/* ── 상주 컴포저 — 탭바 바로 위, 뮤직 미니플레이어 자리 문법 ── */}
      {!composerOpen && (
        <View style={[styles.composerArea, { bottom: tabBarTotalHeight + Spacing.two }]}>
          {/* Pressable 중첩 금지(웹 DOM: button 안 button 불가) — 열기/전송을
              형제 Pressable 로 분리. */}
          <GlassSurface {...Glass.composer} style={styles.composer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="검색 시작"
              onPress={handleComposerOpen}
              style={styles.composerOpenArea}
            >
              <Text style={styles.composerPlaceholder} numberOfLines={1}>
                찾는 옷을 말해보세요
              </Text>
            </Pressable>
            <Pressable
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="전송"
              style={styles.sendBtn}
              onPress={handleSend}
            >
              {Platform.OS === 'web' ? (
                <Text style={styles.sendGlyph}>↑</Text>
              ) : (
                <SymbolView
                  name="arrow.up"
                  size={16}
                  tintColor={IOSColors.systemBackground}
                  weight="bold"
                />
              )}
            </Pressable>
          </GlassSurface>
        </View>
      )}

      {/* ── 탭바 — 하단 고정, 항상 보임(모달/오버레이 제외) ── */}
      {!composerOpen && (
        <View
          style={[
            styles.tabBar,
            { height: tabBarTotalHeight, paddingBottom: insets.bottom },
          ]}
        >
          {TABS.map((item) => {
            const selected = tab === item.key;
            const tintColor = selected ? IOSColors.label : IOSColors.secondaryLabel;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityState={{ selected }}
                style={styles.tabItem}
                onPress={() => handleTabPress(item.key)}
              >
                <View style={styles.tabIconWrap}>
                  {Platform.OS === 'web' ? (
                    <Text style={[styles.tabGlyph, { color: tintColor }]}>{item.glyph}</Text>
                  ) : (
                    <SymbolView name={item.symbol} size={TAB_ICON_SIZE} tintColor={tintColor} weight="regular" />
                  )}
                  {/* 뉴스 탭 미확인 뱃지 — 8px systemRed, 아이콘 우상단. */}
                  {item.key === 'news' && <View style={styles.badge} />}
                </View>
                <Text style={[styles.tabLabel, { color: tintColor }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* ── 컴포저 확장 상태 — 풀스크린 오버레이, 검색 진입(최근 스레드) ── */}
      {composerOpen && (
        <View style={[styles.composerOverlay, { paddingTop: topInset }]}>
          <View style={styles.overlayTopRow}>
            <Pressable
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="닫기"
              style={styles.closeBtn}
              onPress={handleComposerClose}
            >
              {Platform.OS === 'web' ? (
                <Text style={styles.closeGlyph}>✕</Text>
              ) : (
                <SymbolView name="xmark" size={16} tintColor={IOSColors.label} weight="semibold" />
              )}
            </Pressable>
          </View>

          <View style={styles.overlayComposerWrap}>
            <GlassSurface {...Glass.composer} style={styles.composer}>
              <Text style={styles.composerPlaceholder} numberOfLines={1}>
                찾는 옷을 말해보세요
              </Text>
              <Pressable
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="전송"
                style={styles.sendBtn}
                onPress={handleSend}
              >
                {Platform.OS === 'web' ? (
                  <Text style={styles.sendGlyph}>↑</Text>
                ) : (
                  <SymbolView
                    name="arrow.up"
                    size={16}
                    tintColor={IOSColors.systemBackground}
                    weight="bold"
                  />
                )}
              </Pressable>
            </GlassSurface>
          </View>

          <ScrollView
            style={styles.overlayScroll}
            contentContainerStyle={styles.overlayScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionHeader}>최근</Text>
            <View style={styles.groupCard}>
              {RECENT_THREADS.map((thread, i) => (
                <View key={thread.id}>
                  {i > 0 && <View style={styles.rowSeparator} />}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => handleRecentPress(thread.title)}
                    style={({ pressed }) => [styles.listRow, pressed && styles.rowPressed]}
                  >
                    <Text style={styles.listRowTitle} numberOfLines={1}>
                      {thread.title}
                    </Text>
                    {Platform.OS === 'web' ? (
                      <Text style={styles.disclosureGlyph}>›</Text>
                    ) : (
                      <SymbolView name="chevron.right" size={14} tintColor={IOSColors.tertiaryLabel} weight="semibold" />
                    )}
                  </Pressable>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Explore 탭 — 히어로 + 구좌 라벨 2개 + 상품 가로 Row 1줄 ─────────────────
function ExploreTabContent() {
  return (
    <View>
      <Text style={styles.heroTitle} numberOfLines={2}>
        {'몰랐던 브랜드가\n매일 새로 도착해요'}
      </Text>
      <View style={styles.sectionLabelsRow}>
        {EXPLORE_SECTION_LABELS.map((label) => (
          <Text key={label} style={styles.sectionLabelChip}>
            {label}
          </Text>
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.productRow}
        contentContainerStyle={styles.productRowContent}
      >
        {EXPLORE_PRODUCTS.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onPress={() => Haptic.selection()} // mock — PDP 는 실데이터 연동 후 (mock ID 로 push 시 크래시)
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ── 뉴스 탭 — news-lab 다이제스트 압축판(grouped 카드 + 행 2개) ─────────────
function NewsTabContent() {
  return (
    <View>
      <Text style={styles.sectionHeader}>브랜드 소식</Text>
      <View style={styles.groupCard}>
        {NEWS_DIGEST.map((item, i) => (
          <View key={item.id}>
            {i > 0 && <View style={styles.rowSeparator} />}
            <View style={styles.newsRow}>
              <Text style={styles.newsBrand} numberOfLines={1}>
                {item.brand}
              </Text>
              <Text style={styles.newsMessage} numberOfLines={2}>
                {item.message}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── 찜 탭 — grouped 카드 + "찜한 상품 3개" 행(텍스트만) ─────────────────────
function WishlistTabContent() {
  return (
    <View>
      <Text style={styles.sectionHeader}>찜한 상품 3개</Text>
      <View style={styles.groupCard}>
        {WISHLIST_DIGEST.map((item, i) => (
          <View key={item.id}>
            {i > 0 && <View style={styles.rowSeparator} />}
            <View style={styles.listRow}>
              <View style={styles.listRowBody}>
                <Text style={styles.listRowTitle} numberOfLines={1}>
                  {item.label}
                </Text>
                <Text style={styles.listRowDetail} numberOfLines={1}>
                  {item.detail}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.systemGroupedBackground,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
  },

  // ── Explore 히어로 + 구좌 라벨 + 상품 Row ──
  // 아바타 36 — 앱스토어 Today 아바타 크기 준거 (툴바 심볼 버튼 36 실측과 동일 스케일).
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.two,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.secondarySystemFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  heroTitle: {
    ...IOSText.title1,
    fontSize: 27,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.2,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginBottom: Spacing.four,
  },
  sectionLabelsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  sectionLabelChip: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: RadiusRole.chip,
    backgroundColor: IOSColors.tertiarySystemFill,
    overflow: 'hidden',
  },
  productRow: {
    marginHorizontal: -Spacing.three,
  },
  productRowContent: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },

  // ── 섹션 헤더 (news-lab 관례 — footnote·secondary) ──
  sectionHeader: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginLeft: Spacing.three,
    marginBottom: Spacing.one,
  },

  // ── inset grouped 카드 ──
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
  listRow: {
    minHeight: LIST_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  listRowBody: {
    flex: 1,
  },
  listRowTitle: {
    ...IOSText.body,
    flex: 1,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  listRowDetail: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: 1,
  },
  disclosureGlyph: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '600',
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },

  // ── 뉴스 다이제스트 행 ──
  newsRow: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  newsBrand: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  newsMessage: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.half,
  },

  // ── 상주 컴포저 (탭바 위 — home/explore-lab 과 동일 56/44) ──
  composerArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: COMPOSER_HEIGHT,
    borderRadius: RadiusRole.chip,
    paddingLeft: Spacing.four,
    paddingRight: Spacing.two,
    overflow: 'hidden',
  },
  composerOpenArea: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  composerPlaceholder: {
    ...IOSText.body,
    flex: 1,
    color: IOSColors.placeholderText,
    fontFamily: IOSFont.sans,
  },
  sendBtn: {
    width: SEND_BTN_SIZE,
    height: SEND_BTN_SIZE,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendGlyph: {
    fontSize: 18,
    lineHeight: 18,
    fontWeight: '700',
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },

  // ── 탭바 (blueprints "Tab Bars/iPhone/Tabs - No Search/3 Tabs" 높이 62) ──
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    backgroundColor: IOSColors.systemBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: IOSColors.separator,
  },
  tabItem: {
    flex: 1,
    height: TAB_ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  tabIconWrap: {
    position: 'relative',
  },
  tabGlyph: {
    fontSize: TAB_ICON_SIZE,
    lineHeight: TAB_ICON_SIZE + 2,
    fontFamily: IOSFont.sans,
  },
  tabLabel: {
    fontSize: TAB_LABEL_SIZE,
    lineHeight: TAB_LABEL_SIZE + 2,
    fontWeight: '600',
    fontFamily: IOSFont.sans,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -6,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    backgroundColor: IOSColors.systemRed,
  },

  // ── 컴포저 확장(검색 진입) 오버레이 ──
  composerOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: IOSColors.systemBackground,
  },
  overlayTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  closeBtn: {
    width: CLOSE_BTN_SIZE,
    height: CLOSE_BTN_SIZE,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.tertiarySystemFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    fontSize: 16,
    lineHeight: 16,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  overlayComposerWrap: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  overlayScroll: {
    flex: 1,
  },
  overlayScrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
});
