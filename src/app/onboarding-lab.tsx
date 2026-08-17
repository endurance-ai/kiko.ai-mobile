/**
 * 온보딩 3스텝 프로토타입.
 *
 * `/onboarding-lab` 경로에서 열람 가능. 어디에서도 링크되지 않는 dev-only
 * 화면이며, 내비게이션(sidebar, tab, _layout Stack.Screen 등)에 절대
 * 연결하지 않는다 — curation-lab.tsx 와 동일한 관례.
 *
 * 상태머신: 'welcome' → 'gender' → 'taste' → 'done'. 완료 시 로컬 저장
 * (AsyncStorage, src/state/onboarding.ts) 후 홈 진입 — 서버 반영은 로그인
 * 성공 시점에 auth.tsx 가 promoteOnboardingToServer() 로 승격한다.
 * 브랜드 검색은 GET /v1/brands/search 실연동 (실패 시 로컬 스냅샷 폴백).
 *
 * 규칙 참고: docs/design-system.md — 모든 디자인 값은 `@/theme` 토큰을
 * 사용하고(`IOSColors`, `IOSText`, `RadiusRole`, `Glass`, `Duration` 등),
 * 반투명 표면은 전부 `GlassSurface` + `Glass.*` 프리셋을 통해서만 그린다.
 * Spacing 토큰은 main 에서 제거되어 curation-lab.tsx 와 동일하게 컴포넌트
 * 로컬 상수로 재도입한다.
 */
import { Image as ExpoImage } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, ScrollView, StyleSheet, Text, useColorScheme, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { trackOnboarding, type OnboardingEvent } from '@/lib/analytics';
import { saveOnboarding } from '@/state/onboarding';
import {
  MOOD_MAX,
  MOOD_MIN,
  moodsForGender,
  moodsToBrandPicks,
  type MoodTile,
} from '@/state/onboarding-moods';
import {
  BrandColors,
  Duration,
  Elevation,
  Haptic,
  IOSColors,
  IOSFont,
  IOSText,
  Motion,
  Opacity,
  Radius,
  RadiusRole,
} from '@/theme';

// 구 Spacing 토큰 값 (main Phase 2 dead-code 제거로 theme에서 삭제됨) —
// curation-lab.tsx 와 동일하게 프로토타입 로컬로 재도입.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

type Step = 'welcome' | 'value' | 'gender' | 'taste' | 'done';
type Gender = 'women' | 'men' | null;

// 스텝 진입 시 발사할 퍼널 *_viewed 이벤트 (기획 스펙 2026-07). value 스텝은
// 스펙상 'welcome2'. done 은 프로토타입 확인용이라 트래킹 대상 아님(실서비스
// 흐름은 taste → home). 성별→female/male 매핑은 발사 시점에서 변환한다.
const STEP_VIEWED_EVENT: Partial<Record<Step, OnboardingEvent>> = {
  welcome: 'onboarding_welcome_viewed',
  value: 'onboarding_welcome2_viewed',
  gender: 'onboarding_gender_viewed',
  taste: 'onboarding_preference_viewed',
};

// ── 레이아웃 상수 (구조적 수치 — 하드코딩 예외 대상) ───────────────────────
// 컴포넌트 높이 — 애플 UIKit 표준 수치에 정렬 (2026-07-14):
// 내비 바 터치 타깃 44 / 대형 선택 버튼 56(Sign in with Apple 급).
const HEADER_SIDE_SLOT = 44;
const GENDER_CARD_HEIGHT = 56;

export default function OnboardingLabScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');
  const [gender, setGender] = useState<Gender>(null);
  // 선택 무드 id 집합 (삽입 순서 = 선택 순서). 무드 → 멤버 노드 → (성별별)
  // 대표 brand_id 로 펼쳐 저장한다(state/onboarding-moods.ts). 성별을 바꾸면
  // 무드 세트가 갈리므로 초기화한다.
  const [selectedMoods, setSelectedMoods] = useState<Set<string>>(new Set());

  // 콜라주(스텝2) 이미지 미리 데우기 — welcome(스텝1)에 머무는 동안 캐시에
  // 올려, value 스텝 진입 시 네트워크 팝 없이 13장이 한 번에 뜨게 한다.
  useEffect(() => {
    void ExpoImage.prefetch([...WELCOME_COLLAGE_IMAGES], 'memory-disk');
  }, []);

  // 스텝 전환 애니메이션 — 새 스텝 콘텐츠가 opacity 0→1 + translateY 8→0 로
  // 은은하게 나타난다. 트리거성 withTiming (진입/이탈이지 제스처가 아니므로
  // Motion 스프링이 아니라 Duration 계열이 맞다 — docs/design-system.md 규칙4).
  // 시스템 '동작 줄이기' 켜짐 시 전환을 즉시 표시로 폴백 (apple-design §14).
  const reduceMotion = useReducedMotion();
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(8);
  useEffect(() => {
    if (reduceMotion) {
      contentOpacity.value = 1;
      contentTranslateY.value = 0;
      return;
    }
    contentOpacity.value = 0;
    contentTranslateY.value = 8;
    contentOpacity.value = withTiming(1, { duration: Duration.base });
    contentTranslateY.value = withTiming(0, { duration: Duration.base });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, reduceMotion]);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  // 온보딩 퍼널 트래킹 — 스텝 진입 시 *_viewed 발사. 초기 마운트('welcome')와
  // 이후 모든 스텝 전환에서 각각 1회 발사된다(뒤로가기로 재진입해도 발사 —
  // 스펙: "진입 시 발생").
  useEffect(() => {
    const viewedEvent = STEP_VIEWED_EVENT[step];
    if (viewedEvent) trackOnboarding(viewedEvent);
  }, [step]);

  const handleBack = () => {
    Haptic.light();
    if (step === 'value') setStep('welcome');
    else if (step === 'gender') setStep('value');
    else if (step === 'taste') setStep('gender');
  };

  // 자동 진행 대신 선택만 반영 — 진행은 하단 [다음] 버튼으로 (명시적 확인).
  // 성별이 바뀌면 무드 세트가 달라지므로 이전 무드 선택은 버린다.
  const handleSelectGender = (next: 'women' | 'men') => {
    Haptic.selection();
    setGender((prev) => {
      if (prev !== next) setSelectedMoods(new Set());
      return next;
    });
  };

  // 무드 토글 — 최대 MOOD_MAX 개. 상한 도달 시 신규 선택은 무시(라벨·디밍이
  // 이미 상한을 알림), 해제는 언제나 허용.
  const toggleMood = (id: string) => {
    setSelectedMoods((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        Haptic.selection();
      } else if (next.size < MOOD_MAX) {
        next.add(id);
        Haptic.selection();
      } else {
        Haptic.light();
      }
      return next;
    });
  };

  const handleReset = () => {
    Haptic.light();
    setStep('welcome');
    setGender(null);
    setSelectedMoods(new Set());
  };

  // 완료(시작하기/건너뛰기) → gender·selectedBrands 를 로컬 저장(AsyncStorage,
  // src/state/onboarding.ts)하고 홈으로 진입. 홈이 이 값으로 유도 칩을 성별
  // 분기한다. 로그인 성공 시 서버 프로필로 승격 — auth.tsx 가
  // promoteOnboardingToServer() 로 POST /v1/onboarding 전송. 스플래시
  // (index.tsx)가 미완료+비로그인일 때만 이 화면으로 게이트한다.
  const handleFinish = () => {
    Haptic.medium();
    void saveOnboarding({
      gender,
      brands: gender ? moodsToBrandPicks(selectedMoods, gender) : [],
    });
    // from=onboarding 마커 — 홈이 이 진입만 "온보딩 최종 전환"으로 보고
    // main_screen_viewed 를 1회 발사한다(재방문/PDP 왕복 재진입은 제외).
    // 건너뛰기·완료 둘 다 온보딩을 벗어나 메인 진입 = 전환이므로 공통 경로.
    router.replace('/home?from=onboarding');
  };

  // 취향 [다음] 전용 — preference_completed(선택 브랜드 목록·개수)를 발사한 뒤
  // 완료 처리. 건너뛰기는 "다음 버튼 클릭"이 아니므로 이 이벤트를 발사하지
  // 않고 handleFinish 만 태운다(스펙 8번 = 다음 버튼 클릭 시).
  const handleTasteNext = () => {
    const moods = [...selectedMoods];
    const brands = gender ? moodsToBrandPicks(selectedMoods, gender).map((b) => b.name) : [];
    trackOnboarding('onboarding_preference_completed', {
      selected_moods: moods,
      selected_moods_count: moods.length,
      selected_brands: brands,
      selected_brands_count: brands.length,
    });
    handleFinish();
  };

  return (
    <View style={styles.root}>
      {/* 뒤로가기 + 진행 인디케이터 — done 스텝(요약 화면)에서는 숨긴다 */}
      {step !== 'done' && (
        <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
          {step !== 'welcome' ? (
            <Pressable
              hitSlop={8}
              onPress={handleBack}
              style={styles.headerSideSlot}
              accessibilityRole="button"
              accessibilityLabel="뒤로가기"
            >
              {/* SF Symbol 은 웹(react-native-web)에서 렌더되지 않으므로
                  웹에서는 글리프 폴백 — 네이티브는 진짜 chevron.left. */}
              {Platform.OS === 'web' ? (
                <Text style={styles.backGlyph}>‹</Text>
              ) : (
                <SymbolView name="chevron.left" size={20} tintColor={IOSColors.label} weight="medium" />
              )}
            </Pressable>
          ) : (
            <View style={styles.headerSideSlot} />
          )}
          <ProgressDots step={step} />
          <View style={styles.headerSideSlot} />
        </View>
      )}

      <Animated.View style={[styles.content, contentStyle]}>
        {step === 'welcome' && <WelcomeStep />}
        {step === 'value' && <ValueStep />}
        {step === 'gender' && <GenderStep gender={gender} onSelect={handleSelectGender} />}
        {step === 'taste' && (
          <TasteStep gender={gender} selectedMoods={selectedMoods} onToggleMood={toggleMood} />
        )}
        {step === 'done' && (
          <DoneStep
            gender={gender}
            selectedMoods={selectedMoods}
            insets={insets}
            onReset={handleReset}
          />
        )}
      </Animated.View>

      {step === 'welcome' && (
        <View style={[styles.ctaArea, { paddingBottom: insets.bottom + Spacing.three }]}>
          <PrimaryButton
            label="다음"
            onPress={() => {
              trackOnboarding('onboarding_welcome_next_clicked');
              setStep('value');
            }}
          />
        </View>
      )}
      {step === 'value' && (
        <View style={[styles.ctaArea, { paddingBottom: insets.bottom + Spacing.three }]}>
          <PrimaryButton
            label="다음"
            onPress={() => {
              trackOnboarding('onboarding_welcome2_next_clicked');
              setStep('gender');
            }}
          />
        </View>
      )}
      {step === 'gender' && (
        <View style={[styles.ctaArea, { paddingBottom: insets.bottom + Spacing.three }]}>
          <PrimaryButton
            label="다음"
            disabled={!gender}
            onPress={() => {
              // disabled={!gender} 라 여기 도달 시 gender 는 non-null.
              // 스펙 허용값 male/female 로 매핑(코드 내부는 women/men).
              trackOnboarding('onboarding_gender_completed', {
                gender: gender === 'women' ? 'female' : 'male',
              });
              setStep('taste');
            }}
          />
        </View>
      )}
      {/* 취향 CTA — HIG 셋업 플로우 정석: primary 필 버튼 + 아래 텍스트형
          보조 버튼(건너뛰기). 비활성 라벨은 남은 개수를 말하는 동적 지시문. */}
      {step === 'taste' && (
        <View style={[styles.ctaArea, { paddingBottom: insets.bottom + Spacing.two }]}>
          <PrimaryButton
            label={selectedMoods.size >= MOOD_MIN ? '다음' : '무드를 1개 이상 골라주세요'}
            disabled={selectedMoods.size < MOOD_MIN}
            onPress={handleTasteNext}
          />
          <Pressable
            hitSlop={8}
            onPress={() => {
              Haptic.light();
              handleFinish();
            }}
            style={styles.skipUnderCta}
          >
            <Text style={styles.skipText}>건너뛰기</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── ProgressDots — 상단 점 3개 ───────────────────────────────────────────
const STEP_ORDER: Exclude<Step, 'done'>[] = ['welcome', 'value', 'gender', 'taste'];

function ProgressDots({ step }: { step: Exclude<Step, 'done'> }) {
  return (
    <View style={styles.dotsRow}>
      {STEP_ORDER.map((s) => (
        <View key={s} style={[styles.dot, s === step ? styles.dotActive : styles.dotInactive]} />
      ))}
    </View>
  );
}

// ── PrimaryButton — 풀폭 필 CTA ──────────────────────────────────────────
// curation-lab 의 sendBtn 과 동일한 대비 원칙: 배경 IOSColors.label(라이트=
// 검정/다크=흰색) 위 텍스트는 반대로 적응하는 systemBackground.
function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  // press-in 즉시 반응 (curation-lab AnimatedProductCard 와 동일 문법) —
  // Apple "Designing Fluid Interfaces" §1: 터치 다운 순간 피드백이 없으면
  // 인터페이스가 죽어있는 느낌. 화면에서 제일 큰 버튼이 유일하게 무반응이었다.
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const handlePress = () => {
    if (disabled) return;
    Haptic.medium();
    onPress();
  };
  return (
    <Pressable
      unstable_pressDelay={0}
      onPressIn={() => {
        if (!disabled) scale.value = withSpring(0.97, Motion.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, Motion.snappy);
      }}
      onPress={handlePress}
      disabled={disabled}
    >
      <Animated.View style={[styles.ctaButton, disabled && styles.ctaButtonDisabled, scaleStyle]}>
        <Text style={styles.ctaButtonText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── WelcomeStep ──────────────────────────────────────────────────────────
// 시안 2종 토글 비교: 'hand' = 손 인사 + 타이핑 / 'collage' = Apple Music
// 온보딩 레퍼런스와 동일 구성(상단 라운드 카드 안 스퀘클 썸네일 4·4·3·2단
// + 중앙 텍스트). 콜라주 이미지는 DB 스냅샷(results.json)의 실상품 13종 —
// 실서비스는 서버가 공급.
// 해외 대형·인지 브랜드 위주 (Lemaire · Our Legacy · KHAITE(데님) · Stone Island ·
// Jacquemus · Balenciaga · Vivienne Westwood · A.P.C. · Stüssy · Sandy Liang(착용샷) ·
// Acne · Carhartt WIP · Simone Rocha) — DB 스냅샷 실상품 이미지. 착용샷 선호, 신발 제외.
const WELCOME_COLLAGE_IMAGES = [
  'https://cdn.shopify.com/s/files/1/0653/6981/files/279852_IMG_0121.jpg?v=1775769882',
  'https://cdn.shopify.com/s/files/1/0576/7705/4136/files/OurLegacy-Clothing-LongsleeveShirt-WmnsSlipShirtBeige-W2262SEF001-20260319172611_1.jpg?v=1774001402',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/32285329_68985699_2048.webp?v=1781173037',
  'https://cdn.shopify.com/s/files/1/0043/5673/5045/files/L1S156100032-S0060-V018F_01.jpg?v=1771263269',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/36050742_67813064_2048.webp?v=1778749382',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/32248226_68040279_2048_798bdb21-5898-4475-8371-cb2da124896d.webp?v=1779355359',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/32121235_65240784_2048.webp?v=1779967016',
  'https://cdn.shopify.com/s/files/1/0007/0051/4360/files/COGUR-F09085EAF_00.jpg?v=1691686781',
  'https://cdn.shopify.com/s/files/1/0043/5673/5045/files/1140410-FABL_0.jpg?v=1781789115',
  'https://shopamomento.com/web/product/medium/202601/924977b658ca1c2957ab6c03e74ffc6f.jpg',
  'https://cdn.shopify.com/s/files/1/0883/3702/3240/files/23791115_54156581_2048_c657448a-9a12-4eaf-b97e-ac575d9e3710.webp?v=1760085111',
  'https://cdn.shopify.com/s/files/1/0576/7705/4136/files/CarharttWIP-Accessories-ToteBags-CanvasBeachToteMulticolor-I0369261K6XX-20260528143252_1.jpg?v=1779979071',
  'https://shopamomento.com/web/product/medium/202507/2f2887e7c7cc290fef8ee65b27541cbc.jpg',
] as const;
// 레퍼런스와 동일한 단 구성: 4 · 4 · 3 · 2 (가운데 정렬 허니콤).
const COLLAGE_ROWS = [4, 4, 3, 2] as const;
const COLLAGE_THUMB = 64;

// 콜라주 썸네일 — 개별/행 순차 등장을 없애고 한 번에 뜬다(스텝 콘텐츠
// 페이드로 카드 전체가 함께 등장). 이미지는 expo-image memory-disk 캐시 +
// 프리페치(스크린 마운트 시)로 미리 데워, 네트워크 팝 없이 즉시 표시.
function CollageThumb({ uri }: { uri: string }) {
  return (
    <ExpoImage
      source={{ uri }}
      style={styles.collageThumb}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={120}
    />
  );
}

// 콜라주 카드 — memo 로 고정: 타이핑 등 부모 리렌더에 13장 썸네일이 다시
// 그려지며 생기는 젱크를 차단한다 (렉 피드백 대응).
const COLLAGE_ROW_DATA = (() => {
  let cursor = 0;
  return COLLAGE_ROWS.map((count) => {
    const row = WELCOME_COLLAGE_IMAGES.slice(cursor, cursor + count);
    cursor += count;
    return row;
  });
})();

const CollageCard = memo(function CollageCard() {
  return (
    <View style={styles.collageCard}>
      {COLLAGE_ROW_DATA.map((row, ri) => (
        <View key={ri} style={styles.collageRow}>
          {row.map((uri) => (
            <CollageThumb key={uri} uri={uri} />
          ))}
        </View>
      ))}
    </View>
  );
});

const WELCOME_TITLE = '안녕하세요, 키코예요';
const WELCOME_SUB = '밤새 스크롤해도 없던 그 옷\n그냥 저한테 말 걸어주세요';
const TYPE_TICK_MS = 45;

// 스텝 1 — 인사 ("누구인지"): Lóvi 구성, 손 마크 + 에이전트 자기소개 타이핑.
function WelcomeStep() {
  const reduceMotion = useReducedMotion();
  const total = WELCOME_TITLE.length + WELCOME_SUB.length;
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    if (reduceMotion) {
      setRevealed(total);
      return;
    }
    setRevealed(0);
    const id = setInterval(() => {
      setRevealed((n) => {
        if (n >= total) {
          clearInterval(id);
          return n;
        }
        return n + 1;
      });
    }, TYPE_TICK_MS);
    return () => clearInterval(id);
  }, [total, reduceMotion]);

  const titleChars = Math.min(revealed, WELCOME_TITLE.length);
  const subChars = Math.max(0, revealed - WELCOME_TITLE.length);
  const typingTitle = revealed < WELCOME_TITLE.length;
  const typingSub = !typingTitle && revealed < total;

  return (
    <View style={styles.welcomeWrap}>
      <View style={styles.welcomeTopSpacer} />
      <Text style={styles.welcomeHand}>👋</Text>
      <Text style={styles.welcomeTitle}>
        {WELCOME_TITLE.slice(0, titleChars)}
        {typingTitle && <Text style={styles.typeCursor}>▍</Text>}
      </Text>
      <Text style={styles.welcomeSubtitle}>
        {WELCOME_SUB.slice(0, subChars)}
        {typingSub && <Text style={styles.typeCursor}>▍</Text>}
      </Text>
      <View style={styles.welcomeMidSpacer} />
    </View>
  );
}

// 스텝 2 — 가치 제안 ("뭘 해주는지"): Apple Music 구성, 콜라주(증거) 위에
// 확정 카피. 카드 ≈ 상단 40%, 텍스트 블록 ≈ 중앙 아래, CTA 하단.
function ValueStep() {
  return (
    <View style={styles.welcomeWrap}>
      <CollageCard />
      <View style={styles.collageTextSpacer} />
      {/* 확정 카피 (2026-07-14) — 타이틀 = v1.0 시그니처(머릿속→마법),
          서브 = 발견형(취향) + 재고 증거(5,000+). */}
      <Text style={styles.welcomeTitle}>
        머릿속 그 옷,{'\n'}마법처럼 찾아드려요
      </Text>
      <Text style={styles.welcomeSubtitle}>
        당신 취향대로,{'\n'}국내외 5,000+ 디자이너 브랜드에서
      </Text>
      <View style={styles.welcomeMidSpacer} />
    </View>
  );
}

// ── GenderStep ───────────────────────────────────────────────────────────
// 칩 탭 → selection 햅틱 + 선택 표시. 진행은 하단 [다음] CTA (미선택 시 비활성).
function GenderStep({
  gender,
  onSelect,
}: {
  gender: Gender;
  onSelect: (next: 'women' | 'men') => void;
}) {
  return (
    <View style={styles.stepBody}>
      {/* '추천'류 결과 약속 금지 — 이 화면은 질문 하나 받는 자리. 서브는
          질문 보조로만. */}
      <Text style={styles.stepTitle}>어떤 옷을 보여드릴까요?</Text>
      <Text style={styles.stepSubtitle}>먼저 이것부터 알려주세요</Text>

      <View style={styles.genderCards}>
        <GenderCard label="여성복" selected={gender === 'women'} onPress={() => onSelect('women')} />
        <GenderCard label="남성복" selected={gender === 'men'} onPress={() => onSelect('men')} />
      </View>
    </View>
  );
}

function GenderCard({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  // 글래스 대신 애플 표준 filled 버튼 — iOS 26 리퀴드 글래스는 흰 배경 위에
  // 굴절할 배경이 없어 사실상 투명해 버튼으로 안 읽힌다. 미선택은 보더 없이
  // secondarySystemFill(반투명 회색, iOS "회색 filled 버튼" 표준)로 채우고,
  // 선택은 label(블랙) 채움 + 텍스트 반전 — CTA 와 같은 accent 문법.
  // press-scale 0.97 스프링은 PrimaryButton 과 동일 — 큰 탭 타깃에 즉시
  // 반응하는 피드백(apple-design §1)을 CTA 와 통일한다.
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      unstable_pressDelay={0}
      onPressIn={() => {
        scale.value = withSpring(0.97, Motion.snappy);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, Motion.snappy);
      }}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.genderCard,
          selected ? styles.genderCardSelected : styles.genderCardUnselected,
          scaleStyle,
        ]}
      >
        <Text style={[styles.genderCardText, selected && styles.genderCardTextSelected]}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

// ── TasteStep ────────────────────────────────────────────────────────────
function TasteStep({
  gender,
  selectedMoods,
  onToggleMood,
}: {
  gender: Gender;
  selectedMoods: Set<string>;
  onToggleMood: (id: string) => void;
}) {
  const moods = useMemo(() => (gender ? moodsForGender(gender) : []), [gender]);

  // 스크롤 상·하 경계 페이드 — 타일이 서브카피 아래/CTA 위에서 하드 클립되지
  // 않고 배경색으로 자연스럽게 녹아들게. 웹은 IOSColors 폴백이 고정 라이트라
  // 항상 라이트 페이드, 네이티브만 스킴을 따른다(브랜드그리드와 동일 관례).
  const scheme = useColorScheme();
  const isDarkBg = Platform.OS !== 'web' && scheme === 'dark';
  const fadeEdge = isDarkBg ? '#000000' : '#FFFFFF';
  const fadeClear = isDarkBg ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)';

  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>어떤 무드가 끌리세요?</Text>
      <Text style={styles.stepSubtitle}>취향에 맞는 무드를 골라주세요</Text>

      <View style={styles.moodScrollFrame}>
        <ScrollView
          style={styles.moodScroll}
          contentContainerStyle={styles.moodGrid}
          showsVerticalScrollIndicator={false}
        >
          {moods.map((mood, i) => {
            const selected = selectedMoods.has(mood.id);
            return (
              <MoodTileCard
                key={mood.id}
                mood={mood}
                tint={MOOD_TILE_TINTS[i % MOOD_TILE_TINTS.length]}
                selected={selected}
                // 상한 도달 & 미선택 타일은 흐리게 — 더는 못 고른다는 신호.
                dimmed={!selected && selectedMoods.size >= MOOD_MAX}
                onPress={() => onToggleMood(mood.id)}
              />
            );
          })}
        </ScrollView>
        <LinearGradient
          pointerEvents="none"
          colors={[fadeEdge, fadeClear]}
          style={[styles.moodFade, styles.moodFadeTop]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[fadeClear, fadeEdge]}
          style={[styles.moodFade, styles.moodFadeBottom]}
        />
      </View>
    </View>
  );
}

// [시안용 로컬 팔레트 — 사진 도착 전 플레이스홀더 배경. 확정 시 각 무드 사진으로
// 대체되며, 사진 위 하단 스크림이 텍스트 가독성을 보장한다.]
const MOOD_TILE_TINTS = [
  BrandColors.peach[300], // 피치
  '#F5D98F', // 버터 옐로
  '#BFDCB6', // 세이지 그린
  '#AFCBEA', // 페일 블루
  '#DBC5EC', // 라일락
  '#F4C2D2', // 로즈 핑크
  '#B9E0D4', // 민트
  '#E7D3B8', // 샌드
] as const;

// ── MoodTileCard — 사진 배경 + 브랜드 텍스트 오버레이 타일 ──────────────────
// 제스처 구동(선택 press) 이므로 스케일은 스프링(Motion.snappy). 사진이 오면
// mood.image 가 채워져 배경으로 깔리고, 없으면 tint 플레이스홀더가 배경.
function MoodTileCard({
  mood,
  tint,
  selected,
  dimmed,
  onPress,
}: {
  mood: MoodTile;
  tint: string;
  selected: boolean;
  dimmed: boolean;
  onPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const springTo = (v: number) => {
    scale.value = reduceMotion ? v : withSpring(v, Motion.snappy);
  };
  return (
    <Pressable
      unstable_pressDelay={0}
      onPressIn={() => springTo(0.96)}
      onPressOut={() => springTo(1)}
      onPress={onPress}
      style={styles.moodTileSlot}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${mood.name} 무드`}
    >
      <Animated.View
        style={[
          styles.moodTile,
          { backgroundColor: tint },
          selected && styles.moodTileSelected,
          dimmed && styles.moodTileDimmed,
          scaleStyle,
        ]}
      >
        {mood.image != null && (
          <ExpoImage source={mood.image} style={StyleSheet.absoluteFill} contentFit="cover" />
        )}
        {/* 하단 가독성 스크림 — 사진/플레이스홀더 위 텍스트 대비 확보 */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.05)', 'rgba(0,0,0,0.5)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.moodTileText}>
          <Text style={styles.moodName} numberOfLines={1}>
            {mood.name}
          </Text>
          <Text style={styles.moodBrands} numberOfLines={2}>
            {mood.brandLabels.join(' · ')}
          </Text>
        </View>
        {selected && (
          <View style={styles.moodBadge}>
            {Platform.OS === 'web' ? (
              <Text style={styles.moodBadgeCheck}>✓</Text>
            ) : (
              <SymbolView name="checkmark" size={13} tintColor="#1C1C1E" weight="bold" />
            )}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ── DoneStep ─────────────────────────────────────────────────────────────
// 프로토타입 확인용 mock 요약. 실서비스는 로컬 저장(secure-storage) 후
// 메인 진입, 로그인 상태라면 POST /v1/onboarding 으로 서버 동기화한다.
// 취향(③) 스킵 시에는 메인 화면에서 브랜드 취향을 추가로 설정할 수 있는
// 진입점을 별도로 제공할 예정 — 지금은 mock 요약만 보여준다.
function DoneStep({
  gender,
  selectedMoods,
  insets,
  onReset,
}: {
  gender: Gender;
  selectedMoods: Set<string>;
  insets: EdgeInsets;
  onReset: () => void;
}) {
  const moodNames = useMemo(() => {
    if (!gender) return [];
    const byId = new Map(moodsForGender(gender).map((m) => [m.id, m.name]));
    return [...selectedMoods].map((id) => byId.get(id) ?? id);
  }, [selectedMoods, gender]);
  const brandPicks = useMemo(
    () => (gender ? moodsToBrandPicks(selectedMoods, gender) : []),
    [selectedMoods, gender],
  );
  const genderLabel = gender === 'women' ? '여성복' : gender === 'men' ? '남성복' : '미선택';

  return (
    <View style={[styles.doneWrap, { paddingTop: insets.top + Spacing.six }]}>
      <Text style={styles.doneTitle}>온보딩 완료 (mock)</Text>

      <View style={styles.doneRow}>
        <Text style={styles.doneLabel}>성별</Text>
        <Text style={styles.doneValue}>{genderLabel}</Text>
      </View>
      <View style={styles.doneRow}>
        <Text style={styles.doneLabel}>선택 무드 ({moodNames.length})</Text>
        <Text style={styles.doneValue}>{moodNames.length > 0 ? moodNames.join(', ') : '없음'}</Text>
      </View>
      <View style={styles.doneRow}>
        <Text style={styles.doneLabel}>펼친 brand_id ({brandPicks.length})</Text>
        <Text style={styles.doneValue}>
          {brandPicks.length > 0 ? brandPicks.map((b) => b.id).join(', ') : '없음'}
        </Text>
      </View>

      <Pressable onPress={onReset} style={styles.doneResetBtn}>
        <Text style={styles.doneResetBtnText}>처음부터</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: IOSColors.systemBackground,
  },

  // 상단 헤더 — 뒤로가기 / 진행 점 3개
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerSideSlot: {
    width: HEADER_SIDE_SLOT,
    height: HEADER_SIDE_SLOT,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  dotsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: Radius.pill,
  },
  dotActive: {
    backgroundColor: IOSColors.label,
  },
  dotInactive: {
    backgroundColor: IOSColors.tertiaryLabel,
  },

  // 스텝 콘텐츠 공통 래퍼 (애니메이션 대상)
  content: {
    flex: 1,
  },
  stepBody: {
    flex: 1,
    // 왼쪽만 한 단계 더 (16→24) — 백버튼 chevron 은 아이콘 특성상 실제
    // 획이 슬롯 안쪽 ~8px 에서 그려져서, 타이틀을 24 에서 시작해야 획과
    // 옵티컬 정렬이 맞는다 (7/14 피드백).
    paddingLeft: Spacing.four,
    paddingRight: Spacing.three,
    paddingTop: 0,
  },
  stepTitle: {
    ...IOSText.title2,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  stepSubtitle: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    marginTop: Spacing.two,
    fontFamily: IOSFont.sans,
  },

  // 하단 고정 CTA
  ctaArea: {
    paddingHorizontal: Spacing.three,
  },
  // UIButton large 구성과 동일한 50pt — 텍스트는 headline(17 semibold).
  ctaButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: RadiusRole.chip,
    backgroundColor: IOSColors.label,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaButtonText: {
    ...IOSText.headline,
    color: IOSColors.systemBackground,
    fontFamily: IOSFont.sans,
  },

  // ── 웰컴 스텝 ──
  welcomeWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.five,
  },
  // 손+텍스트 그룹 수직 중앙 정렬 (7/14 피드백 — 상단 30% 배치가 살짝
  // 떠 보임). 위아래 동일 flex 로 광학 중앙에 앉힌다.
  // 손-텍스트 간격은 flex 가 아니라 타이틀 marginTop 으로 고정(밀착).
  welcomeTopSpacer: {
    flex: 1,
  },
  welcomeMidSpacer: {
    flex: 1,
  },
  // 손 인사 마크 — 이모지를 심볼로 크게.
  welcomeHand: {
    fontSize: 56,
    lineHeight: 68,
  },
  // 콜라주 카드 — 레퍼런스와 동일: 큰 라운드의 옅은 회색 카드 안에
  // 스퀘클 썸네일이 가운데 정렬 허니콤으로.
  collageCard: {
    alignSelf: 'stretch',
    borderRadius: Radius.xxl,
    backgroundColor: IOSColors.systemGroupedBackground,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
    gap: Spacing.two,
  },
  collageRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  collageThumb: {
    width: COLLAGE_THUMB,
    height: COLLAGE_THUMB,
    borderRadius: COLLAGE_THUMB * 0.34,
    backgroundColor: IOSColors.systemGray5,
  },
  // 레퍼런스 비율 — 카드 아래 여백 : 텍스트 아래 여백 ≈ 0.8 : 1.2 로
  // 텍스트 블록이 화면 중앙 살짝 아래(~57%)에 앉는다.
  collageTextSpacer: {
    flex: 0.8,
  },
  typeCursor: {
    color: IOSColors.tertiaryLabel,
  },
  welcomeTitle: {
    ...IOSText.title1,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    marginTop: Spacing.four + Spacing.two,
  },
  welcomeSubtitle: {
    ...IOSText.body,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
    marginTop: Spacing.two,
    lineHeight: 26,
  },

  // ── 성별 스텝 ──
  genderCards: {
    marginTop: Spacing.five,
    gap: Spacing.three,
  },
  // 채움 캡슐 pill — 위아래 1개씩. 선택 상태만 색이 갈린다.
  genderCard: {
    // 다이나믹 타입 확대 시 라벨이 잘리지 않게 min 만 고정.
    minHeight: GENDER_CARD_HEIGHT,
    borderRadius: GENDER_CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // 미선택 = 보더 없는 회색 채움 (iOS 표준 secondary filled 버튼).
  genderCardUnselected: {
    backgroundColor: IOSColors.secondarySystemFill,
  },
  // 선택 = 블랙 필 (label 토큰 — 라이트=검정/다크=흰색, CTA 버튼과 동일 문법).
  genderCardSelected: {
    backgroundColor: IOSColors.label,
  },
  genderCardText: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  genderCardTextSelected: {
    color: IOSColors.systemBackground,
  },

  // ── 취향 스텝 ──
  skipText: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: 2,
  },
  // CTA 아래 텍스트형 보조 버튼 — 터치 타깃 확보용 패딩.
  skipUnderCta: {
    alignSelf: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.one,
  },
  // 웹 폴백 글리프 (SF Symbol 미렌더 대응) — 크기·두께를 chevron.left 에 근사.
  backGlyph: {
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '500',
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  ctaButtonDisabled: {
    opacity: Opacity.muted,
  },
  // ── 무드 스텝 ──
  // 스크롤 프레임 — 상·하 페이드 오버레이의 absolute 기준.
  moodScrollFrame: {
    flex: 1,
    marginTop: Spacing.four,
  },
  moodScroll: {
    flex: 1,
  },
  moodFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 32,
    zIndex: 1,
  },
  moodFadeTop: {
    top: 0,
    // 상단은 아주 짧게 — 얇은 경계 페이드만.
    height: 16,
  },
  moodFadeBottom: {
    bottom: 0,
  },
  // 2열 그리드 — 슬롯 폭 48%, 행 간격만 gap 으로(열 간격은 space-between).
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: Spacing.three,
    // 첫 타일 행이 서브카피/상단 페이드에 붙지 않게 스크롤 시작부에 여백.
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
  },
  moodTileSlot: {
    width: '48%',
  },
  // 세로 사진 비율(3:4). 사진이 오면 mood.image 가 absoluteFill 로 배경에 깔린다.
  moodTile: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  moodTileSelected: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    ...Elevation.raised,
  },
  moodTileDimmed: {
    opacity: Opacity.muted,
  },
  moodTileText: {
    padding: Spacing.three,
    gap: 2,
  },
  moodName: {
    ...IOSText.headline,
    color: '#FFFFFF',
    fontFamily: IOSFont.sans,
    fontWeight: '700',
  },
  moodBrands: {
    ...IOSText.caption1,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: IOSFont.sans,
  },
  // 선택 순서 배지 — 우상단 원형, 브랜드 피치 필.
  moodBadge: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Elevation.raised,
  },
  // 웹 폴백 체크 글리프 (네이티브는 SF Symbol checkmark).
  moodBadgeCheck: {
    ...IOSText.footnote,
    color: '#1C1C1E',
    fontFamily: IOSFont.sans,
    fontWeight: '800',
    lineHeight: 16,
  },

  // ── done 스텝 ──
  doneWrap: {
    flex: 1,
    paddingHorizontal: Spacing.three,
  },
  doneTitle: {
    ...IOSText.title2,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    marginBottom: Spacing.four,
  },
  doneRow: {
    marginBottom: Spacing.three,
  },
  doneLabel: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    marginBottom: Spacing.half,
  },
  doneValue: {
    ...IOSText.footnote,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    lineHeight: 20,
  },
  doneResetBtn: {
    marginTop: Spacing.five,
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: RadiusRole.chip,
    backgroundColor: IOSColors.secondarySystemFill,
  },
  doneResetBtnText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    fontWeight: '600',
  },
});
