/**
 * [v1.2 시안] 브랜드 홈 — 팔로우의 앵커 화면. 2026-08-04 최종 확정본(A안).
 *
 * 구성(위→아래): ‹ 플로팅(36 글래스) → 브랜드명 20 Semibold(섹션 헤더와
 * 동일 급 — 위계는 배치가 만듦) → 설명 3줄 자연 말줄임(텍스트 전체 탭 →
 * 전문 바텀시트, 시트에 ✕ 34 + 공홈 링크) → [최근 소식 ›](애플뮤직 섹션
 * 타이틀 문법 → /brand-news-lab) → 상품 3열 엣지투엣지 무한(SSENSE 가격:
 * 브랜드명·현재가 동일 타이포, 할인 시 정가 취소선).
 *
 * 푸터 플로팅(컴포저 스케일 56): [팔로우] 필 + 벨 원형. 인터랙션:
 *  - 팔로우 탭 = 즉시 성립(취향 신호) → 시트 "세일, 신상 소식도
 *    알려드릴까요?" — [팔로우만 할게요]여도 팔로우 유지 (핵심 설계)
 *  - 벨 탭(미팔로우) = 자동 팔로우 + 같은 시트 / 팔로잉 상태 = 알림 토글
 *  - 찜 = 즉시 성립, 첫 찜 1회만 제안 시트(선택 기억)
 * 데이터: follow + notify_enabled, POST /v1/brands/:id/follow {notify}.
 *
 * 데이터 mock = brand_nodes.wiki 실데이터(Jaded London, 7/15 리서치 행).
 * 실서비스 GET /v1/brands/:id — 재리서치에 logo_url 추가 예정.
 * 벨 = SF bell/bell.fill (웹은 data-URI SVG 폴백 — 이모지 금지 규칙).
 * 최근 소식 = 알림 문안 체계와 동일 소스·문안(수치 이벤트만).
 *
 * dev-only ([권한 ON/OFF] 필은 시연용). 기준: .claude/skills/apple-hig →
 * docs/apple-blueprints.md → docs/design-system.md.
 */
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { MOCK_PRODUCTS } from '@/state/products';
import {
  Glass,
  Haptic,
  IOSColors,
  IOSFont,
  IOSText,
  Motion,
  Opacity,
  Radius,
  Scrim,
  withAlpha,
} from '@/theme';

// 구 Spacing 토큰 값 — 다른 lab 화면과 동일하게 로컬 재도입.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

// ── iOS 27 실측 구조 상수 (docs/apple-blueprints.md) ─────────────────────
const GROUP_CARD_RADIUS = 26;
const TOOLBAR_BTN = 36;
const CTA_HEIGHT = 50; // 버튼 Large (시트 내부 CTA 용 — blueprints 실측)
const FOOTER_CONTROL = 56; // 푸터 상주 컨트롤 — 컴포저 표준 스케일(2026-07-14 확정)과 통일

// ── brand_nodes.wiki 실데이터 (2026-07-27, PostgreSQL 그대로) ─────────────
// Jaded London — 7/15 리서치 완료 행. 재리서치 JSON 스키마의 실제 모습 확인용.
// 실서비스는 GET /v1/brands/:id 로 이 구조를 그대로 받는다.
const BRAND_MOCK = {
  brand_name: 'Jaded London',
  origin_country: 'GB',
  instagram_handle: 'jadedldn',
  homepage: 'https://jadedldn.com/en-us/',
  keywords_ko: ['Y2K', '펑크', '스트릿', '바디컨셔스', '페스티벌룩'],
  price_range_krw: { min: 40000, max: 200000, typical: 90000 },
  description_ko:
    '제이디드 런던(Jaded London)은 2013년 영국 런던에서 남매 디자이너가 론칭한 스트릿 기반 브랜드로, Y2K·펑크 감성의 대담한 프린트와 바디컨셔스 실루엣이 특징이다. 무신사 엠프티에서 성수동 단독 팝업을 진행할 만큼 국내에서도 인지도가 높으며, 공식몰 외 무신사·리볼브 등 글로벌 편집숍에 입점해 있다.',
  style_node: '아트스쿨 인디 스트릿',
} as const;

// ── 최근 소식 — 알림 문안 체계 기반 (세일 2줄, 신상 1줄 — brand-news-lab 동일) ──
const RECENT_NEWS = [
  { id: 'bn1', message: '제이디드 런던 세일 시작했어요', sub: '최대 40% 싸요', relativeTime: '2시간 전' },
  { id: 'bn2', message: '제이디드 런던에 신상 12개가 들어왔어요', sub: null, relativeTime: '3일 전' },
] as const;

// 무한스크롤 mock — 시안은 12개로 시연 (실서비스는 페이지네이션 fetch).
// HIG: 무한 컬렉션은 페이지의 마지막 섹션이어야 한다 (아래 도달 불가 콘텐츠 금지).
// 3개 중 1개꼴로 할인 mock (SSENSE식 정가 취소선 시연용).
// 썸네일 = 실상품 사진 (골든셋 결과 CDN — 단색 블록 mock 은 화면 인상을 죽임).
const FEED_IMAGE_URLS = [
  'https://cdn.shopify.com/s/files/1/0640/6121/0837/files/cts47DR2A4F26090-02400.jpg?v=1772553831',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/31004376_60179368_2048.webp?v=1781774089',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/34091006_65047708_2048.webp?v=1772700868',
  'https://cdn.shopify.com/s/files/1/0094/2252/files/KHW031231-101-Front.jpg?v=1779204331',
  'https://cdn.shopify.com/s/files/1/0557/6743/3394/files/8B3AEBH021BAD6-SHORTSLEEVES-VALENTINO-Donna-20260205120212_0.jpg?v=1770293555',
  'https://cdn.shopify.com/s/files/1/0094/2252/files/FB36151KNPCL_8f1a1aae-6cef-43b4-9f31-2930c6744e7c.jpg?v=1774371151',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/32028852_65785175_2048.webp?v=1775726193',
  'https://cdn.shopify.com/s/files/1/0094/2252/files/KHM061210-002-Front.jpg?v=1770158486',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/32284905_68986925_2048.webp?v=1781774764',
  'https://cdn.shopify.com/s/files/1/0557/6743/3394/files/C01DSBKPV00SILVER-MINIBAGS-INNERRAUM-Donna-20260320122045_1.jpg?v=1774013226',
  'https://cdn.shopify.com/s/files/1/0576/7705/4136/files/Nike-Clothing-Shortsleeve-NikeAcg_22wildsee_22Men_27sDri-fitShort-sleeveBaseLayerMulticolor-IO1452-819-20260205122457_1.jpg?v=1770306183',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/34033488_68669871_2048.webp?v=1780654729',
] as const;
const FEED_PRODUCTS = [...MOCK_PRODUCTS, ...MOCK_PRODUCTS].slice(0, 12).map((prod, i) => ({
  ...prod,
  imageUrl: FEED_IMAGE_URLS[i % FEED_IMAGE_URLS.length],
  originalPriceWon: i % 3 === 0 ? Math.round((prod.priceWon * 1.35) / 1000) * 1000 : null,
}));


// 웹 전용 SF bell 근사 SVG — SymbolView 미렌더 폴백. 의존성 없이
// data URI 로 렌더 (RNW Image 는 웹에서 <img> 라 SVG 지원).
const BELL_PATH =
  'M12 3c-.6 0-1.1.4-1.2 1l-.1.6C8 5.3 6.2 7.7 6.2 10.6v3.8l-1.5 2.2c-.4.6 0 1.4.8 1.4h13c.8 0 1.2-.8.8-1.4l-1.5-2.2v-3.8c0-2.9-1.8-5.3-4.5-6l-.1-.6c-.1-.6-.6-1-1.2-1zm-2 16.2a2 2 0 004 0h-4z';
const bellUri = (fill: string) =>
  `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${fill}" d="${BELL_PATH}"/></svg>`;

// 디스클로저(›) — news-lab 과 동일.
function Disclosure() {
  return Platform.OS === 'web' ? (
    <Text style={styles.disclosureGlyph}>›</Text>
  ) : (
    <SymbolView name="chevron.right" size={14} tintColor={IOSColors.tertiaryLabel} weight="semibold" />
  );
}

export default function BrandLabScreen() {
  const insets = useSafeAreaInsets();
  // 웹 미리보기는 safe-area 인셋이 0 → 다이나믹 아일랜드 영역과 겹침.
  // 실기기 상태바 인셋(아이폰 14 Pro 계열 59)을 웹에서만 심는다.
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;
  const { width: windowWidth } = useWindowDimensions();
  // 팔로우(취향 신호)와 알림(푸시)을 분리 (2026-08-03 확정) — 알림을 거절해도
  // 팔로우는 성립해 취향 점수표에 반영된다. 인스타/무신사 '팔로우+벨' 문법.
  const [followed, setFollowed] = useState(false);
  const [notifyEnabled, setNotifyEnabled] = useState(false);
  // ── 찜 → 알림 플로우 mock (2026-07-27 확정) ──
  // 시스템 푸시 권한 상태를 dev 토글로 흉내낸다. 실서비스는 expo-notifications
  // getPermissionsAsync 결과.
  const [pushGranted, setPushGranted] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [primingVisible, setPrimingVisible] = useState(false);
  const [askedPinNotify, setAskedPinNotify] = useState(false);
  const [descSheetVisible, setDescSheetVisible] = useState(false);

  // 찜 규칙 (2026-08-04 확정 — 팔로우와 공통 패턴): 찜은 항상 즉시 성립,
  // 알림은 제안일 뿐. 첫 찜 1회만 시트("찜한 상품이 세일하면 알림
  // 보내드릴까요?") — 매번 띄우면 마찰이라 선택을 기억해 이후 찜에 적용.
  // [아니오]여도 찜은 유지(취향 신호 존속), 알림만 OFF. 상품별 변경은
  // 설정 > 찜한 상품별.
  const handlePin = (id: string) => {
    const nowPinned = !pinnedIds.has(id);
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    Haptic.medium();
    if (nowPinned && !askedPinNotify) {
      setAskedPinNotify(true); // 첫 찜 1회만 제안 (mock — 실서비스는 로컬 저장)
      setPrimingVisible(true);
    }
  };

  const handleBack = () => {
    Haptic.light();
    router.back();
  };

  const [notifySheetVisible, setNotifySheetVisible] = useState(false);

  // [팔로우] — 즉시 성립(취향 반영), 이어서 소식 시트로 알림 여부 제안.
  // 알림 거절해도 팔로우 유지가 이 설계의 핵심.
  const handleToggleFollow = () => {
    if (followed) {
      Haptic.medium();
      setFollowed(false);
      setNotifyEnabled(false);
      return;
    }
    Haptic.medium();
    setFollowed(true);
    setNotifySheetVisible(true);
  };

  // 시트 [알림도 받기] — (mock) 권한 승인 포함, 알림 ON.
  const handleEnableNotify = () => {
    setPushGranted(true);
    setNotifyEnabled(true);
    setNotifySheetVisible(false);
  };

  // 벨 토글 — 미팔로우면 팔로우까지 한 번에 성립. OFF→ON 시 권한 게이트.
  const handleToggleBell = () => {
    if (notifyEnabled) {
      Haptic.selection();
      setNotifyEnabled(false);
      return;
    }
    if (!followed) setFollowed(true);
    if (!pushGranted) {
      Haptic.light();
      setNotifySheetVisible(true);
      return;
    }
    Haptic.selection();
    setNotifyEnabled(true);
  };

  return (
    <View style={[styles.root, { width: windowWidth }]}>
      {/* 플로팅 글래스 뒤로가기 — 툴바 36 캡슐 (news-lab 통일) */}
      <View style={[styles.floatingBar, { top: topInset + Spacing.one }]}>
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

        <View style={styles.barRight}>
          {/* dev — 푸시 권한 상태 mock 토글 */}
          <Pressable
            hitSlop={6}
            accessibilityRole="button"
            onPress={() => {
              Haptic.selection();
              setPushGranted((v) => !v);
            }}
          >
            <GlassSurface {...Glass.chip} isInteractive style={styles.devPermPill}>
              <Text style={styles.devPermText}>권한 {pushGranted ? 'ON' : 'OFF'}</Text>
            </GlassSurface>
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topInset + TOOLBAR_BTN + Spacing.four,
            paddingBottom: insets.bottom + Spacing.six + 80, // 하단 플로팅 컨트롤(56) 클리어런스
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── A안(현행): 타이틀 + 설명 + CTA 페어 ── */}
        <Text style={styles.brandName}>{BRAND_MOCK.brand_name}</Text>
        {/* 3줄 자연 말줄임 — 텍스트 자체가 탭 영역, 탭 시 전문 바텀시트
            ("모두 보기" 링크 제거, 2026-07-27 확정). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="브랜드 설명 전체 보기"
          onPress={() => {
            Haptic.light();
            setDescSheetVisible(true);
          }}
          style={({ pressed }) => pressed && styles.sheetPressed}
        >
          <Text style={styles.description} numberOfLines={3}>
            {BRAND_MOCK.description_ko}
          </Text>
        </Pressable>

        {/* ── 섹션: 최근 소식 › — 애플뮤직 섹션 타이틀 문법 (타이틀+디스클로저
            자체가 탭 영역, 파란 텍스트 없음) → 전체 리스트 푸시 ── */}
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="브랜드 소식 전체 보기"
          onPress={() => {
            Haptic.light();
            router.push('/brand-news-lab' as never);
          }}
          style={({ pressed }) => [styles.sectionHeaderRow, pressed && styles.sheetPressed]}
        >
          <Text style={[styles.sectionHeader, styles.sectionHeaderInRow]}>최근 소식</Text>
          {Platform.OS === 'web' ? (
            <Text style={styles.sectionChevron}>›</Text>
          ) : (
            <SymbolView name="chevron.right" size={17} tintColor={IOSColors.secondaryLabel} weight="semibold" />
          )}
        </Pressable>
        <View style={styles.groupCard}>
          {RECENT_NEWS.map((news, i) => (
            <View key={news.id}>
              {i > 0 && <View style={styles.rowSeparator} />}
              <View style={styles.newsRow}>
                <View style={styles.newsRowBody}>
                  <Text style={styles.newsMessage}>{news.message}</Text>
                  {news.sub != null && <Text style={styles.newsSub}>{news.sub}</Text>}
                  <Text style={styles.newsTime}>{news.relativeTime}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* ── 섹션: 상품 — 기존 리스트 디자인(3열 엣지투엣지, list.tsx 문법),
            페이지 마지막 = 무한스크롤 (mock 12개). 타일 = 썸네일(가격 필 없음)
            + 브랜드명·가격 (2026-07-27 썸네일 방식 확정). ── */}
        <Text style={styles.sectionHeader}>상품</Text>
        <View style={styles.productGrid}>
          {FEED_PRODUCTS.map((product, i) => (
            <Pressable
              key={`${product.id}-${i}`}
              accessibilityRole="button"
              onPress={() => Haptic.selection()} // mock — PDP 는 실데이터 연동 후 (mock ID 로 push 시 크래시)
              onLongPress={() => handlePin(product.id)}
              style={[styles.tile, { width: (windowWidth) / 3 }]}
            >
              <Image source={{ uri: product.imageUrl }} style={styles.tileThumb} resizeMode="cover" />
              {/* SSENSE 문법 — 브랜드명·현재가 동일 타이포, 할인 시 정가
                  취소선(연하게)만 추가 (2026-07-27 확정). */}
              <View style={styles.tileMeta}>
                <Text style={styles.tileBrand} numberOfLines={1}>
                  {product.brand}
                </Text>
                <View style={styles.tilePriceRow}>
                  <Text style={styles.tilePrice} numberOfLines={1}>
                    ₩{product.priceWon.toLocaleString()}
                  </Text>
                  {product.originalPriceWon != null && (
                    <Text style={styles.tileOriginalPrice} numberOfLines={1}>
                      ₩{product.originalPriceWon.toLocaleString()}
                    </Text>
                  )}
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* 하단 플로팅 CTA — HIG Toolbars(현재 뷰 액션 = 하단 툴바 자리) ·
          Apple Store 앱 '가방에 추가' 문법. 스크롤 내내 상시 노출. */}
      <View style={[styles.ctaFooter, { paddingBottom: insets.bottom + Spacing.three }]}>
        <View style={styles.followRow}>
          <View style={styles.followSlot}>
            <FollowButton followed={followed} onToggle={handleToggleFollow} />
          </View>
          {/* 벨 토글 — 상시 노출 (애플뮤직 스타일 2버튼). 팔로우 전 탭 시
              팔로우까지 한 번에 성립 (알림은 팔로우 전제). */}
          {(
            <Pressable
              hitSlop={6}
              accessibilityRole="button"
              accessibilityState={{ selected: notifyEnabled }}
              accessibilityLabel={notifyEnabled ? '브랜드 알림 끄기' : '브랜드 알림 켜기'}
              onPress={handleToggleBell}
            >
              {({ pressed }) => (
                <GlassSurface
                  {...Glass.chip}
                  isInteractive
                  style={[styles.bellBtn, notifyEnabled && styles.bellBtnOn, pressed && styles.sheetPressed]}
                >
                  {Platform.OS === 'web' ? (
                    <Image
                      source={{ uri: bellUri(notifyEnabled ? 'white' : 'black') }}
                      style={styles.bellIcon}
                    />
                  ) : (
                    <SymbolView
                      name={notifyEnabled ? 'bell.fill' : 'bell'}
                      size={24}
                      tintColor={notifyEnabled ? IOSColors.systemBackground : IOSColors.label}
                      weight="medium"
                    />
                  )}
                </GlassSurface>
              )}
            </Pressable>
          )}
        </View>
      </View>

      {/* 찜 프라이밍 (첫 찜 + 권한 OFF) */}
      <PermissionPrimingSheet
        visible={primingVisible}
        title={'찜한 상품이 세일하면\n알림 보내드릴까요?'}
        primaryLabel="알림 받을게요"
        onPrimary={() => {
          setPushGranted(true); // mock — 실서비스는 시스템 권한 요청 포함
          setPrimingVisible(false);
        }}
        onClose={() => setPrimingVisible(false)}
      />
      {/* 팔로우 직후 소식 제안 — 거절([팔로우만 할게요])해도 팔로우는 유지 */}
      <PermissionPrimingSheet
        visible={notifySheetVisible}
        title={'세일, 신상 소식도\n알려드릴까요?'}
        primaryLabel="알림도 받기"
        secondaryLabel="팔로우만 할게요"
        onPrimary={handleEnableNotify}
        onClose={() => setNotifySheetVisible(false)}
      />
      <DescriptionSheet
        visible={descSheetVisible}
        title={BRAND_MOCK.brand_name}
        body={BRAND_MOCK.description_ko}
        onClose={() => setDescSheetVisible(false)}
      />
    </View>
  );
}

// ── PermissionPrimingSheet — 첫 찜 직후 맥락과 함께 권한 요청 (mock) ───────
// news-lab 과 동일 문법. 실서비스는 [알림 켜기] 탭 시 시스템 권한 다이얼로그.
function PermissionPrimingSheet({
  visible,
  title,
  primaryLabel,
  secondaryLabel = '나중에',
  onPrimary,
  onClose,
}: {
  visible: boolean;
  title: string;
  primaryLabel: string;
  secondaryLabel?: string;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.sheetScrim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={[styles.sheetCard, { paddingBottom: insets.bottom + Spacing.four }]}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.sheetPrimaryBtn, pressed && styles.sheetPressed]}
            onPress={() => {
              Haptic.medium();
              onPrimary();
            }}
          >
            <Text style={styles.sheetPrimaryText}>{primaryLabel}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.sheetSecondaryBtn, pressed && styles.sheetPressed]}
            onPress={() => {
              Haptic.light();
              onClose();
            }}
          >
            <Text style={styles.sheetSecondaryText}>{secondaryLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── DescriptionSheet — 브랜드 설명 전문 바텀시트 ─────────────────────────
function DescriptionSheet({
  visible,
  title,
  body,
  onClose,
}: {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={styles.sheetScrim}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={[styles.sheetCard, styles.descSheetCard, { paddingBottom: insets.bottom + Spacing.four }]}>
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            onPress={onClose}
            style={({ pressed }) => [styles.sheetCloseBtn, pressed && styles.sheetPressed]}
          >
            {Platform.OS === 'web' ? (
              <Text style={styles.sheetCloseGlyph}>✕</Text>
            ) : (
              <SymbolView name="xmark" size={14} tintColor={IOSColors.secondaryLabel} weight="semibold" />
            )}
          </Pressable>
          <Text style={styles.descSheetTitle}>{title}</Text>
          <Text style={styles.descSheetBody}>{body}</Text>
          {/* 공홈 링크 — CTA 영역에서 제거하고 여기로 (브랜드 정보 맥락에서만) */}
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="공식 스토어 방문"
            onPress={() => Haptic.light()}
            style={({ pressed }) => [styles.descSheetLink, pressed && styles.sheetPressed]}
          >
            <View style={styles.descSheetLinkRow}>
              <Text style={styles.descSheetLinkText}>공식 스토어 방문</Text>
              {Platform.OS === 'web' ? (
                <Text style={styles.descSheetLinkArrow}>↗</Text>
              ) : (
                <SymbolView name="arrow.up.right" size={13} tintColor={IOSColors.systemBlue} weight="semibold" />
              )}
            </View>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── FollowButton — 핵심 CTA. 미구독=블랙 캡슐 채움 / 구독=글래스 반전 ────
function FollowButton({
  followed,
  onToggle,
}: {
  followed: boolean;
  onToggle: () => void;
}) {
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      unstable_pressDelay={0}
      accessibilityRole="button"
      accessibilityState={{ selected: followed }}
      accessibilityLabel={followed ? '팔로잉, 해제하려면 탭' : '브랜드 팔로우'}
      onPressIn={() => {
        scale.value = withSpring(0.97, Motion.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, Motion.snappy);
      }}
      onPress={onToggle}
    >
      {followed ? (
        <Animated.View style={scaleStyle}>
          <GlassSurface {...Glass.chip} isInteractive style={[styles.followBtn, styles.followBtnOn]}>
            <Text style={styles.followBtnTextOn}>팔로잉 ✓</Text>
          </GlassSurface>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.followBtn, styles.followBtnOff, scaleStyle]}>
          <Text style={styles.followBtnTextOff}>팔로우</Text>
        </Animated.View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // inset grouped 페이지 (news-lab 통일) — 헤더까지 grouped 배경 위에.
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
    justifyContent: 'space-between',
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

  // ── 헤더 — 큰 브랜드명 + 한 줄 메타 + 두 줄 소개 (미니멀) ──
  // 크기 대신 굵기로만 위계 (2026-07-27) — title3(20) Bold. 본문(subhead 15)
  // 과의 대비는 웨이트가 만든다 (GPT/Claude 결의 절제).
  // 섹션 헤더(Prominent 20 Semibold)와 완전 동일 — 화면 내 타이틀 급 통일
  // (2026-08-03 확정).
  brandName: {
    ...IOSText.title3,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  description: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.three,
  },

  barRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  descSheetCard: {
    alignItems: 'flex-start',
  },
  // 시트 닫기 버튼 34×34 (blueprints 실측) — 우상단.
  sheetCloseBtn: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.secondarySystemFill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetCloseGlyph: {
    fontSize: 15,
    lineHeight: 16,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  descSheetTitle: {
    ...IOSText.title3,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginBottom: Spacing.three,
  },
  descSheetBody: {
    ...IOSText.body,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    lineHeight: 24,
  },
  descSheetLink: {
    minHeight: 44,
    justifyContent: 'center',
    marginTop: Spacing.three,
  },
  descSheetLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  descSheetLinkText: {
    ...IOSText.body,
    color: IOSColors.systemBlue,
    fontFamily: IOSFont.sans,
  },
  descSheetLinkArrow: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.systemBlue,
    fontFamily: IOSFont.sans,
  },

  followRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: Spacing.two,
  },
  followSlot: {
    flex: 1,
  },
  bellBtn: {
    width: FOOTER_CONTROL,
    height: FOOTER_CONTROL,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  bellBtnOn: {
    backgroundColor: IOSColors.label,
  },
  bellIcon: {
    width: 24,
    height: 24,
  },
  // 하단 플로팅 CTA 푸터 — 좌우 인셋 16, 배경 없음(버튼 자체가 표면).
  ctaFooter: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: 0,
  },
  followBtn: {
    minHeight: FOOTER_CONTROL,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followBtnOff: {
    backgroundColor: IOSColors.label,
  },
  followBtnOn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: IOSColors.separator,
    overflow: 'hidden',
  },
  followBtnTextOff: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
  followBtnTextOn: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },

  // ── 섹션 공통 (news-lab 통일) ──
  // Prominent 섹션 헤더 (blueprints: Lists/Header/Prominent — SFPro-Semibold 20).
  // 콘텐츠 페이지 문법 — 13 소형 라벨은 설정식이라 격이 안 맞음 (2026-08-03).
  sectionHeader: {
    ...IOSText.title3,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  // 애플뮤직 문법 — 타이틀 옆 › (secondaryLabel), 행 전체가 탭 영역.
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    alignSelf: 'flex-start',
    // 세로 마진을 행으로 올린다 — 자식(타이틀/셰브런)에 비대칭 마진이 있으면
    // alignItems:center 가 셰브런을 타이틀의 마진박스 중앙(=글자보다 위)에
    // 맞춰 수직 정렬이 어긋난다. 행이 마진을 갖고 자식은 마진 0으로 둔다.
    marginTop: Spacing.five,
    marginBottom: Spacing.two,
  },
  // 행 안의 타이틀은 세로 마진 제거(행이 대신 가짐). 단독 '상품' 헤더는
  // sectionHeader 단독 사용이라 기존 마진 유지.
  sectionHeaderInRow: {
    marginTop: 0,
    marginBottom: 0,
  },
  // 셰브런 광학 보정 — › 글리프는 폰트 크기 대비 작게 그려져서, 타이틀
  // 20pt와 눈높이가 같아 보이려면 글리프를 키워야 함 (애플뮤직 관찰 기준).
  // 웹 전용 글리프 광학 보정 — 웹 라인박스에서 큰 글리프가 낮게 앉아
  // translateY 로 올림. 실기기는 SF Symbol(chevron.right)이라 해당 없음.
  sectionChevron: {
    fontSize: 30,
    lineHeight: 30,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    transform: [{ translateY: -2 }],
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
  rowPressed: {
    backgroundColor: IOSColors.systemGray5,
  },
  disclosureGlyph: {
    fontSize: 20,
    lineHeight: 20,
    fontWeight: '600',
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },

  // ── 최근 소식 행 ──
  newsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  newsRowBody: {
    flex: 1,
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

  // ── 상품 3열 그리드 — list.tsx 미러 (엣지투엣지, 컬럼 갭 없음, rowGap 16,
  // 썸네일 aspect 0.82). scrollContent 패딩(16)을 음수 마진으로 상쇄.
  productGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
    marginHorizontal: -Spacing.three,
  },
  tile: {},
  tileThumb: {
    width: '100%',
    aspectRatio: 0.82,
    backgroundColor: IOSColors.tertiarySystemBackground,
    marginBottom: 2,
  },
  // SSENSE 문법 — 브랜드명·현재가 동일 폰트·크기·두께. 할인 정가만
  // 취소선 + 연하게 (tertiary).
  tileMeta: {
    paddingHorizontal: Spacing.one,
  },
  tilePriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.one,
  },
  tileBrand: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  tilePrice: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  tileOriginalPrice: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    textDecorationLine: 'line-through',
  },


  // dev 토글 (우상단) — 시연용 소음 최소화: 소형 + 저대비.
  devPermPill: {
    height: 28,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
    overflow: 'hidden',
    opacity: Opacity.muted,
  },
  devPermText: {
    ...IOSText.caption1,
    fontWeight: '600',
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
  },

  // 프라이밍 시트 (news-lab 문법)
  sheetScrim: {
    flex: 1,
    backgroundColor: withAlpha('#000000', Scrim.heavy),
    justifyContent: 'flex-end',
  },
  sheetCard: {
    backgroundColor: IOSColors.systemBackground,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    alignItems: 'center',
  },
  sheetTitle: {
    ...IOSText.title3,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  sheetPrimaryBtn: {
    width: '100%',
    minHeight: CTA_HEIGHT,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
  sheetSecondaryBtn: {
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  sheetSecondaryText: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  sheetPressed: {
    opacity: Opacity.softened,
  },
});
