/**
 * [알림 트랙 시안 v3] 뉴스 = 키코의 대화형 소식 채널 — dev-only, 내비게이션
 * 연결 금지, 커밋 전 사용자 확정 필요.
 *
 * 2026-08-04 최종 확정 구조 (셸프/그리드 v2 폐기 — git 히스토리 참조):
 *  - 뉴스 탭 = 키코와의 단일 대화 스레드. 두 종류 메시지가 시간순 혼류:
 *    ① 데일리 브리핑 — 클로드 루틴 산출물(매일 ~20개, 무검수 — 뒷단 루틴이
 *       품질 담당) 을 하루 1버블 다이제스트로
 *    ② 개인 알림 — 찜 세일/재입고·팔로우 브랜드 소식 (발송 배치가 푸시와
 *       동시에 이 스레드에 적재 → 스레드가 "놓친 푸시의 영수증")
 *  - 푸시 탭 → 이 스레드 랜딩. 알림 거절 유저도 여기서 개인 소식 열람.
 *  - 콜드 스타트 없음: 브리핑은 유저 행동 무관 매일 존재.
 *  - 상품 연결은 자연스러울 때만 (트래픽/리텐션 우선 — 전환은 메인 큐레이션 몫).
 *  - [윤영] 브리핑 아이템 계약 = { title, link } 순서 고정 (타이틀 줄 + 출처
 *    도메인 링크 줄). 링크 탭 → 인앱 브라우저(사파리 뷰)로 원문. 데이터는
 *    클로드 루틴 산출물이 노션 어드민 DB → 크론 동기화로 그대로 들어옴 —
 *    클라는 형식 가정 없이 title/link 렌더만. 웹 시안의 Haptic mock 은
 *    실구현 시 openBrowserAsync 로 교체.
 *  - 하단 컴포저 = 소식에 이어서 질문 (대화니까). mock 은 캔드 응답.
 *  - 역할 분담: Explore = MD 큐레이션(쇼핑) / 뉴스 = 데일리 브리핑(정보·재미·
 *    리텐션) / 푸시 = 개인 훅 / 찜·팔로우 상태 흔적 = 찜 구좌·브랜드 홈.
 *
 * 기준: .claude/skills/apple-hig(규범) → docs/apple-blueprints.md(치수) →
 *       docs/design-system.md(토큰). ☰ = 동급 표면 문법 (Explore·뉴스).
 * 헤더 우측 "팝업"/"권한" = dev 전용 모달 시연 (온보딩 고지 / 권한 프라이밍).
 */
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import {
  Glass,
  Haptic,
  IOSColors,
  IOSFont,
  IOSText,
  Opacity,
  Radius,
  Scrim,
  withAlpha,
} from '@/theme';

// 구 Spacing 토큰 값 — 다른 lab 화면과 동일하게 로컬 재도입.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

const TOOLBAR_BTN = 36; // 툴바 심볼 캡슐 (blueprints)

// ── 스레드 mock — 실서비스는 GET /v1/news/thread (페이지네이션, 최신이 아래) ──
// 읽기 전용 방송 채널 (2026-08-04 확정 — 카톡 채널/텔레그램 채널 문법:
// 말풍선 형태, 답장 없음). 문답형 업그레이드는 v1.3+ 백로그.
// 개인 알림은 별도 [알림] 소식함으로 분리 (혼류 안 함).
type ThreadMessage =
  | { kind: 'date'; id: string; label: string }
  | { kind: 'briefing'; id: string; intro: string; items: { title: string; link: string }[]; time: string };

const THREAD: ThreadMessage[] = [
  { kind: 'date', id: 'd1', label: '어제' },
  {
    kind: 'briefing',
    id: 'b1',
    intro: '어제의 패션 소식이에요',
    items: [
      { title: '발레코어가 다시 올라오고 있어요, 리본과 새틴 검색 급증', link: 'vogue.co.kr' },
      { title: '무신사 엠프티가 성수에서 Jaded London 팝업을 열어요', link: 'musinsa.com' },
      { title: '살로몬 XT-6 새 컬러가 국내 발매를 앞두고 있어요', link: 'hypebeast.kr' },
      { title: 'LOW CLASSIC 이 26FW 프리오더를 시작했어요', link: 'lowclassic.com' },
      { title: '체크 패턴이 초가을 프리뷰로 떠요, 타탄과 깅엄 강세', link: 'wkorea.com' },
    ],
    time: '오전 8:00',
  },
  { kind: 'date', id: 'd2', label: '오늘' },
  {
    kind: 'briefing',
    id: 'b2',
    intro: '오늘의 패션 소식이에요',
    items: [
      { title: '마르지엘라 타비가 다시 품절 행진, 리셀가도 상승 중', link: 'kream.co.kr' },
      { title: '서울패션위크 라인업 공개, KIJUN과 OPEN YY 포함', link: 'seoulfashionweek.org' },
      { title: '고프코어 바람이 가방으로, 테크 슬링백 검색 급증', link: 'hypebeast.kr' },
      { title: '유니클로 U 26FW 룩북이 공개됐어요', link: 'uniqlo.com' },
      { title: '빈티지 리바이스 501 시세가 한 달 새 12% 상승', link: 'ebay.com' },
    ],
    time: '오전 8:00',
  },
];

type DemoModal = 'none' | 'onboarding' | 'permission';

export default function NewsLabScreen() {
  const insets = useSafeAreaInsets();
  // 웹 미리보기 safe-area 심 (다른 lab 과 동일).
  const topInset = Platform.OS === 'web' ? Math.max(insets.top, 59) : insets.top;
  const { width: windowWidth } = useWindowDimensions();
  const [demoModal, setDemoModal] = useState<DemoModal>('none');
  // 뉴스 온보딩 (2026-08-04 확정, 바텀시트 → 풀스크린 페이지로 정정) —
  // 첫 진입 1회, 피쳐 소개 + 브리핑 알림 옵트인. HIG pre-alert 문법:
  // 가치 설명(받게 될 알림 프리뷰) 후 시스템 다이얼로그 1회.
  // [알림 받을게요] → (권한 포함) briefing ON / [앱에서만 볼게요] → OFF,
  // 어느 쪽이든 뉴스 탭 진입 (콘텐츠 유지, 알림만 선택).
  // mock: 마운트 시 노출 — 실서비스는 로컬 저장으로 1회 제한.
  const [onboardingVisible, setOnboardingVisible] = useState(true);
  const thread = THREAD;

  // ☰ = 동급 표면 문법 (Explore·뉴스는 사이드바로 전환).
  const handleOpenSidebar = () => {
    Haptic.light();
    router.push('/lab-sidebar' as never);
  };


  return (
    <View style={[styles.root, { width: windowWidth }]}>
      {/* 플로팅 바 — ☰ + 중앙 타이틀 + dev 시연 필 */}
      <View style={[styles.floatingBar, { top: topInset + Spacing.one }]}>
        <View pointerEvents="none" style={styles.navTitleWrap}>
          <Text style={styles.navTitle}>뉴스</Text>
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
        <View style={styles.devBtns}>
          {(['onboarding', 'permission'] as const).map((kind) => (
            <Pressable
              key={kind}
              hitSlop={6}
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.pressedDim}
              onPress={() => {
                Haptic.light();
                setDemoModal(kind);
              }}
            >
              <GlassSurface {...Glass.chip} isInteractive style={styles.toolbarPillText}>
                <Text style={styles.devBtnText}>{kind === 'onboarding' ? '팝업' : '권한'}</Text>
              </GlassSurface>
            </Pressable>
          ))}
        </View>
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
        {thread.map((m) => {
          if (m.kind === 'date') {
            return (
              <Text key={m.id} style={styles.dateChip}>
                {m.label}
              </Text>
            );
          }
          if (m.kind === 'briefing') {
            return (
              <View key={m.id} style={styles.kikoBubbleRow}>
                <View style={styles.kikoBubble}>
                  <Text style={styles.kikoIntro}>{m.intro}</Text>
                  {m.items.map((item, i) => (
                    <View key={i} style={styles.briefingItem}>
                      <Text style={styles.briefingBullet}>{i + 1}</Text>
                      <View style={styles.briefingBody}>
                        <Text style={styles.briefingText}>{item.title}</Text>
                        <Pressable
                          hitSlop={4}
                          accessibilityRole="link"
                          accessibilityLabel={`${item.link} 원문 열기`}
                          onPress={() => Haptic.selection()} // mock — 실서비스: 인앱 브라우저로 원문
                          style={({ pressed }) => pressed && styles.pressedDim}
                        >
                          <Text style={styles.briefingLink}>{item.link}</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                  <Text style={styles.msgTime}>{m.time}</Text>
                </View>
              </View>
            );
          }
          return null;
        })}
      </ScrollView>

      <OnboardingSubscriptionModal
        visible={demoModal === 'onboarding'}
        onClose={() => setDemoModal('none')}
      />
      <PermissionPrimingSheet
        visible={demoModal === 'permission'}
        onClose={() => setDemoModal('none')}
      />
      {/* 뉴스 온보딩 — ChatGPT 원격 설정 문법의 톨 바텀시트 (첫 진입 1회) */}
      <NewsOnboardingSheet
        visible={onboardingVisible}
        bottomInset={Platform.OS === 'web' ? Math.max(insets.bottom, 34) : insets.bottom}
        onDone={() => setOnboardingVisible(false)}
      />
    </View>
  );
}

// ── NewsOnboardingSheet — 뉴스 첫 진입 톨 바텀시트 (2026-08-04 확정) ──────
// [윤영] 레퍼런스 = ChatGPT iOS 앱 "원격 설정" 시트 (설정 > 원격 설정 진입
// 시 노출되는 풀높이 바텀시트). 실기기에서 직접 열어 대조 권장. 명세:
//   - 시트: 높이 ~94%, 상단만 라운드(28), 뒤 배경 딤. 스와이프 다운 닫기.
//   - ✕: 좌상단 40 연회색 솔리드 원(systemGray6), 검정 xmark 17.
//   - 중앙 아이콘: 검정 라인 글리프 ~72 (우리: SF newspaper 72).
//   - 타이틀: 22 Bold 중앙 (largeTitle 아님 — 컴팩트 시트 타이틀).
//   - 서브: body 17 secondary 중앙 2줄.
//   - 기능 불릿: 아이콘 34(label) + body 17 secondary(회색), 아이콘은 첫 줄
//     고정, 행 간격 32, 좌우 인셋 24+24. 블록은 타이틀~CTA 사이 세로 중앙.
//   - CTA: 블랙 필 56 + 아래 텍스트형 보조(우리 앱 문법 — 레퍼런스는
//     아웃라인 필이지만 자기 일관성 우선으로 텍스트 채택, 2026-08-04 확정).
// HIG pre-alert: 가치 설명 후 시스템 권한 다이얼로그 1회.
function NewsOnboardingSheet({
  visible,
  bottomInset,
  onDone,
}: {
  visible: boolean;
  bottomInset: number;
  onDone: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType={reduceMotion ? 'fade' : 'slide'}
      onRequestClose={onDone}
    >
      <View style={styles.obScrim}>
        <View style={[styles.obSheet, { paddingBottom: bottomInset + Spacing.three }]}>
          {/* ✕ 좌상단 — 닫기 = [앱에서만 볼게요]와 동일 */}
          <Pressable
            hitSlop={8}
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel="닫기"
            style={styles.obCloseBtn}
          >
            {/* 레퍼런스: 연회색 솔리드 원 (글래스 아님) */}
            <View style={styles.obCloseCircle}>
              {Platform.OS === 'web' ? (
                <Text style={styles.obCloseGlyph}>✕</Text>
              ) : (
                <SymbolView name="xmark" size={17} tintColor={IOSColors.label} weight="semibold" />
              )}
            </View>
          </Pressable>

          <View style={styles.obWrap}>
            {/* 중앙 아이콘 — 뉴스 글리프 (네이티브 SF newspaper) */}
            <View style={styles.obIconWrap}>
              {Platform.OS === 'web' ? (
                <Text style={styles.obIconGlyph}>▤</Text>
              ) : (
                <SymbolView name="newspaper" size={72} tintColor={IOSColors.label} weight="medium" />
              )}
            </View>

            <Text style={styles.obTitle}>매일 아침 패션 소식</Text>
            <Text style={styles.obSub}>
              밤새 올라온 트렌드와 드랍 소식을{'\n'}키코가 대신 읽고 정리해드려요
            </Text>

            {/* 기능 불릿 — 타이틀과 CTA 사이 세로 중앙 (아이콘 = 첫 줄 고정) */}
            <View style={styles.obFeatureCenter}>
              <View style={styles.obFeatureList}>
                <View style={styles.obFeatureRow}>
                  <View style={styles.obFeatureIconBox}>
                    {Platform.OS === 'web' ? (
                      <Text style={styles.obFeatureIcon}>☀</Text>
                    ) : (
                      <SymbolView name="sun.max" size={34} tintColor={IOSColors.label} weight="medium" />
                    )}
                  </View>
                  <Text style={styles.obFeatureText}>
                    매일 아침 8시,{'\n'}가장 트렌디한 소식 10개 도착해요
                  </Text>
                </View>
                <View style={styles.obFeatureRow}>
                  <View style={styles.obFeatureIconBox}>
                    {Platform.OS === 'web' ? (
                      <Text style={styles.obFeatureIcon}>◷</Text>
                    ) : (
                      <SymbolView name="clock" size={34} tintColor={IOSColors.label} weight="medium" />
                    )}
                  </View>
                  <Text style={styles.obFeatureText}>
                    스크롤 없이 1분이면{'\n'}오늘 씬을 다 읽어요
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.obCtaArea}>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.obPrimaryBtn, pressed && styles.pressedDim]}
              onPress={() => {
                Haptic.medium();
                onDone(); // mock — 실서비스: 시스템 권한 요청 + 설정 briefing ON
              }}
            >
              <Text style={styles.modalPrimaryText}>알림 받을게요</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressedDim]}
              onPress={() => {
                Haptic.light();
                onDone();
              }}
            >
              <Text style={styles.modalSecondaryText}>앱에서만 볼게요</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── OnboardingSubscriptionModal — 온보딩 팔로우 고지 (Alert 문법 · dev 시연) ──
function OnboardingSubscriptionModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalScrim}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            온보딩에서 고른 브랜드 6개를{'\n'}팔로우했어요, 소식을 알려드릴게요
          </Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressedDim]}
            onPress={() => {
              Haptic.medium();
              onClose();
            }}
          >
            <Text style={styles.modalPrimaryText}>알림 받을게요</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressedDim]}
            onPress={() => {
              Haptic.light();
              onClose();
            }}
          >
            <Text style={styles.modalSecondaryText}>알림 끄기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── PermissionPrimingSheet — 푸시 권한 프라이밍 (dev 시연, reduced-motion 폴백) ──
function PermissionPrimingSheet({
  visible,
  onClose,
}: {
  visible: boolean;
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
        <Pressable accessibilityRole="button" accessibilityLabel="닫기" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheetCard, { paddingBottom: insets.bottom + Spacing.four }]}>
          <Text style={styles.sheetTitle}>찜한 상품이 세일하면{'\n'}바로 알려드릴게요</Text>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.pressedDim]}
            onPress={() => {
              Haptic.medium();
              onClose();
            }}
          >
            <Text style={styles.modalPrimaryText}>알림 켜기</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.pressedDim]}
            onPress={() => {
              Haptic.light();
              onClose();
            }}
          >
            <Text style={styles.modalSecondaryText}>나중에</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // 대화형 — 플레인 배경 (Chat 과 동일 문법).
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
    justifyContent: 'space-between',
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
  toolbarPillText: {
    height: TOOLBAR_BTN,
    borderRadius: Radius.pill,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    overflow: 'hidden',
  },
  menuGlyph: {
    fontSize: 17,
    lineHeight: 18,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  devBtns: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  devBtnText: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },

  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },

  // 날짜 칩 — iMessage 문법 (중앙, footnote secondary).
  dateChip: {
    ...IOSText.footnote,
    fontWeight: '600',
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    marginTop: Spacing.two,
  },

  // 키코 버블 — 좌측, 불투명 (콘텐츠 레이어라 글래스 아님).
  kikoBubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  kikoBubble: {
    maxWidth: '92%',
    backgroundColor: IOSColors.tertiarySystemBackground,
    borderRadius: 20,
    borderTopLeftRadius: Radius.sm,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  kikoIntro: {
    ...IOSText.subhead,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginBottom: Spacing.two,
  },
  briefingItem: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  briefingBullet: {
    ...IOSText.footnote,
    fontWeight: '700',
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    width: 14,
    textAlign: 'right',
  },
  briefingBody: {
    flex: 1,
  },
  briefingText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  // 출처 링크 — 파란 소문자 도메인 (노스크롤 요약+링크 형식).
  briefingLink: {
    ...IOSText.footnote,
    color: IOSColors.systemBlue,
    fontFamily: IOSFont.sans,
    marginTop: 1,
  },
  msgTime: {
    ...IOSText.caption1,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.one,
  },



  pressedDim: {
    opacity: Opacity.softened,
  },

  // ── 뉴스 온보딩 (톨 바텀시트, ChatGPT 원격 설정 문법) ──
  obScrim: {
    flex: 1,
    backgroundColor: withAlpha('#000000', Scrim.heavy),
    justifyContent: 'flex-end',
  },
  // 거의 풀스크린 시트 — 상단만 라운드, 뒤로 앱이 살짝 보임 (레퍼런스 비율).
  obSheet: {
    height: '94%',
    backgroundColor: IOSColors.systemBackground,
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingTop: Spacing.three,
  },
  obCloseBtn: {
    marginLeft: Spacing.three,
    alignSelf: 'flex-start',
  },
  obWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
  },
  // 레퍼런스 ✕ — 40 연회색 솔리드 원.
  obCloseCircle: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.systemGray6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // 레퍼런스 CTA 높이 56 (모달 공용 50과 분리 — 이 시트 전용).
  obPrimaryBtn: {
    width: '100%',
    minHeight: 56,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  obCloseGlyph: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '600',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  obIconWrap: {
    marginBottom: Spacing.four,
  },
  obIconGlyph: {
    fontSize: 72,
    lineHeight: 76,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  // 레퍼런스 실측 — title2 22 Bold 중앙 (컴팩트 시트 타이틀).
  obTitle: {
    ...IOSText.title2,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
  },
  obSub: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    marginTop: Spacing.two,
  },
  // 세로 중앙 래퍼 — 남은 공간의 가운데 + 블록 가로 중앙 (레퍼런스:
  // 불릿 블록은 콘텐츠 폭으로 수축해 좌우 여백이 균형).
  obFeatureCenter: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: Spacing.six, // CTA 쪽으로 살짝 띄워 광학 중앙
  },
  // 블록 = 콘텐츠 폭 (행이 화면으로 늘어나지 않음 — 중앙 앉힘의 전제).
  obFeatureList: {
    gap: Spacing.five,
  },
  // 아이콘 = 첫 줄 정렬 (두 줄 감김에도 고정 — 애플 기능 리스트 문법).
  obFeatureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  // 고정폭 박스 — 글리프 폭 차이와 무관하게 두 행의 x 축 통일.
  obFeatureIconBox: {
    width: 48,
    alignItems: 'center',
    // body 17(lineHeight ~22) 첫 줄과 광학 정렬.
    marginTop: -5,
  },
  obFeatureIcon: {
    fontSize: 34,
    lineHeight: 36,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  // 레퍼런스 — 불릿 본문은 회색. 지정 개행이라 flex 스트레치 불필요
  // (콘텐츠 폭 수축을 위해 flex 제거, 안전 상한만).
  obFeatureText: {
    ...IOSText.body,
    maxWidth: 300,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
  obCtaArea: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },

  // 모달 공통 (기존 문법 유지 — Alert / 시트).
  modalScrim: {
    flex: 1,
    backgroundColor: withAlpha('#000000', Scrim.heavy),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: IOSColors.systemBackground,
    borderRadius: Radius.xxl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.three,
    alignItems: 'center',
  },
  modalTitle: {
    ...IOSText.title3,
    fontWeight: '700',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    marginBottom: Spacing.four,
  },
  modalPrimaryBtn: {
    width: '100%',
    minHeight: 50,
    borderRadius: Radius.pill,
    backgroundColor: IOSColors.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },
  modalSecondaryBtn: {
    width: '100%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  modalSecondaryText: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
  },
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
});
