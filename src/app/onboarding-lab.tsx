/**
 * 온보딩 3스텝 프로토타입.
 *
 * `/onboarding-lab` 경로에서 열람 가능. 어디에서도 링크되지 않는 dev-only
 * 화면이며, 내비게이션(sidebar, tab, _layout Stack.Screen 등)에 절대
 * 연결하지 않는다 — curation-lab.tsx 와 동일한 관례.
 *
 * 상태머신: 'welcome' → 'gender' → 'taste' → 'done'. 실제 서비스에서는
 * done 시점에 로컬 저장(secure-storage) 후 메인으로 진입하고, 로그인
 * 상태라면 POST /v1/onboarding 으로 서버에도 반영한다 — 여기서는 mock
 * 요약 화면만 보여준다.
 *
 * 규칙 참고: docs/design-system.md — 모든 디자인 값은 `@/theme` 토큰을
 * 사용하고(`IOSColors`, `IOSText`, `RadiusRole`, `Glass`, `Duration` 등),
 * 반투명 표면은 전부 `GlassSurface` + `Glass.*` 프리셋을 통해서만 그린다.
 * Spacing 토큰은 main 에서 제거되어 curation-lab.tsx 와 동일하게 컴포넌트
 * 로컬 상수로 재도입한다.
 */
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useEffect, useMemo, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { saveOnboarding } from '@/state/onboarding';
import { STYLE_NODES } from '@/state/style-nodes';
import {
  BrandColors,
  BrandRole,
  Duration,
  Elevation,
  Glass,
  Haptic,
  IOSColors,
  IOSFont,
  IOSText,
  Motion,
  Opacity,
  Radius,
  RadiusRole,
  withAlpha,
} from '@/theme';

// 구 Spacing 토큰 값 (main Phase 2 dead-code 제거로 theme에서 삭제됨) —
// curation-lab.tsx 와 동일하게 프로토타입 로컬로 재도입.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

type Step = 'welcome' | 'value' | 'gender' | 'taste' | 'done';
type Gender = 'women' | 'men' | null;

// ── 레이아웃 상수 (구조적 수치 — 하드코딩 예외 대상) ───────────────────────
// 컴포넌트 높이 — 애플 UIKit 표준 수치에 정렬 (2026-07-14):
// 내비 바 터치 타깃 44 / 대형 선택 버튼 56(Sign in with Apple 급) /
// 콘텐츠 칩 48(≥44 최소 타깃) / 보조 칩 44(최소 타깃 하한).
const HEADER_SIDE_SLOT = 44;
const GENDER_CARD_HEIGHT = 56;
const BRAND_CHIP_HEIGHT = 48;
const SEARCH_CHIP_HEIGHT = 44;
const MAX_SEARCH_RESULTS = 8;
// 성별 카드 선택 → 다음 스텝 자동 진입까지의 유예(스펙 300ms) — 선택 표시가
// 눈에 보일 최소한의 시간만 주고 바로 넘어간다.
const MIN_TASTE_PICKS = 3;

// ── STYLE_NODES 파생 헬퍼 ────────────────────────────────────────────────
// 브랜드 그리드/검색/노드 매핑 모두 STYLE_NODES 21종에서 성별 필드만
// 갈아끼워 파생한다 — 노드명(code/nameKo/nameEn)은 화면에 절대 노출하지
// 않고 브랜드명만 노출한다.

// women: repBrandWomen 21개 전부. men: repBrandMen 이 null 이 아닌 19개
// (Q·R 코드는 men 풀에 앵커 브랜드가 없어 그리드에서 제외 — style-nodes.ts 주석 참고).
function getRepBrands(gender: 'women' | 'men'): string[] {
  const brands: string[] = [];
  for (const node of STYLE_NODES) {
    const rep = gender === 'women' ? node.repBrandWomen : node.repBrandMen;
    if (rep) brands.push(rep);
  }
  return brands;
}

// 검색 스냅샷 풀 — repBrand + sampleBrands 전체를 성별 기준으로 flatten·dedup.
// 실서비스는 GET /v1/brands/search — 프로토타입은 이 로컬 스냅샷에서만 찾는다.
function getSearchPool(gender: 'women' | 'men'): string[] {
  const pool = new Set<string>();
  for (const node of STYLE_NODES) {
    const rep = gender === 'women' ? node.repBrandWomen : node.repBrandMen;
    const samples = gender === 'women' ? node.sampleBrandsWomen : node.sampleBrandsMen;
    if (rep) pool.add(rep);
    for (const sample of samples) pool.add(sample);
  }
  return Array.from(pool);
}

// 선택된 브랜드명 → STYLE_NODES 역매핑으로 노드 id 유도 (done 화면 확인용).
// repBrand 또는 sampleBrands 어느 쪽에 매칭돼도 해당 노드를 채택한다.
function mapBrandsToNodeIds(selectedBrands: Set<string>, gender: Gender): number[] {
  if (!gender || selectedBrands.size === 0) return [];
  const ids: number[] = [];
  for (const node of STYLE_NODES) {
    const rep = gender === 'women' ? node.repBrandWomen : node.repBrandMen;
    const samples = gender === 'women' ? node.sampleBrandsWomen : node.sampleBrandsMen;
    const candidates: string[] = rep ? [rep, ...samples] : [...samples];
    if (candidates.some((brand) => selectedBrands.has(brand))) {
      ids.push(node.id);
    }
  }
  return ids;
}

export default function OnboardingLabScreen() {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('welcome');
  const [gender, setGender] = useState<Gender>(null);
  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

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

  const handleBack = () => {
    Haptic.light();
    if (step === 'value') setStep('welcome');
    else if (step === 'gender') setStep('value');
    else if (step === 'taste') setStep('gender');
  };

  // 자동 진행 대신 선택만 반영 — 진행은 하단 [다음] 버튼으로 (명시적 확인).
  const handleSelectGender = (next: 'women' | 'men') => {
    Haptic.selection();
    setGender(next);
  };

  const toggleBrand = (brand: string) => {
    Haptic.selection();
    setSelectedBrands((prev) => {
      const next = new Set(prev);
      if (next.has(brand)) next.delete(brand);
      else next.add(brand);
      return next;
    });
  };

  const handleReset = () => {
    Haptic.light();
    setStep('welcome');
    setGender(null);
    setSelectedBrands(new Set());
    setSearchQuery('');
  };

  // 완료(시작하기/건너뛰기) → gender·selectedBrands 를 로컬 저장(AsyncStorage,
  // src/state/onboarding.ts)하고 홈으로 진입. 홈이 이 값으로 유도 칩을 성별
  // 분기한다. 로그인 성공 시 서버 프로필로 승격(POST /v1/onboarding — 추후
  // 배선, 서버 기존 값 우선). 스플래시(index.tsx)가 미완료+비로그인일 때만
  // 이 화면으로 게이트한다.
  const handleFinish = () => {
    Haptic.medium();
    void saveOnboarding({ gender, brands: [...selectedBrands] });
    router.replace('/home');
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
          <TasteStep
            gender={gender}
            selectedBrands={selectedBrands}
            onToggleBrand={toggleBrand}
            searchQuery={searchQuery}
            onChangeSearch={setSearchQuery}
          />
        )}
        {step === 'done' && (
          <DoneStep
            gender={gender}
            selectedBrands={selectedBrands}
            insets={insets}
            onReset={handleReset}
          />
        )}
      </Animated.View>

      {step === 'welcome' && (
        <View style={[styles.ctaArea, { paddingBottom: insets.bottom + Spacing.three }]}>
          <PrimaryButton label="다음" onPress={() => setStep('value')} />
        </View>
      )}
      {step === 'value' && (
        <View style={[styles.ctaArea, { paddingBottom: insets.bottom + Spacing.three }]}>
          <PrimaryButton label="다음" onPress={() => setStep('gender')} />
        </View>
      )}
      {step === 'gender' && (
        <View style={[styles.ctaArea, { paddingBottom: insets.bottom + Spacing.three }]}>
          <PrimaryButton label="다음" disabled={!gender} onPress={() => setStep('taste')} />
        </View>
      )}
      {/* 취향 CTA — HIG 셋업 플로우 정석: primary 필 버튼 + 아래 텍스트형
          보조 버튼(건너뛰기). 비활성 라벨은 남은 개수를 말하는 동적 지시문. */}
      {step === 'taste' && (
        <View style={[styles.ctaArea, { paddingBottom: insets.bottom + Spacing.two }]}>
          <PrimaryButton
            label={
              selectedBrands.size >= MIN_TASTE_PICKS
                ? '다음'
                : selectedBrands.size === 0
                  ? '3개만 골라주세요'
                  : `${MIN_TASTE_PICKS - selectedBrands.size}개 더 골라주세요`
            }
            disabled={selectedBrands.size < MIN_TASTE_PICKS}
            onPress={handleFinish}
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

// 콜라주 썸네일 — 행 단위로 차분하게 페이드 (개별 팝 13번은 산만해서
// 행 4번의 순차 등장으로 정리). 움직임은 미세한 상승만, 스케일 없음.
function CollageThumb({ uri, row }: { uri: string; row: number }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    const id = setTimeout(() => {
      progress.value = withTiming(1, { duration: Duration.base });
    }, row * 90);
    return () => clearTimeout(id);
  }, [row, progress, reduceMotion]);
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 4 }],
  }));
  return (
    <Animated.View style={style}>
      <Image source={{ uri }} style={styles.collageThumb} />
    </Animated.View>
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
            <CollageThumb key={uri} uri={uri} row={ri} />
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
  return (
    <Pressable onPress={onPress}>
      <GlassSurface {...Glass.chip} isInteractive style={styles.genderCard}>
        {/* GlassSurface 는 내부적으로 style 뒤에 자체 base/edge 스타일을 다시
            머지해 backgroundColor 를 style prop 으로 덮어쓰기 어렵다 —
            선택 강조는 children 으로 얹는 불투명 오버레이(블랙/label)로
            그린다. 텍스트는 반전(systemBackground). */}
        {selected && <View pointerEvents="none" style={styles.genderCardTint} />}
        <Text style={[styles.genderCardText, selected && styles.genderCardTextSelected]}>
          {label}
        </Text>
      </GlassSurface>
    </Pressable>
  );
}

// ── TasteStep ────────────────────────────────────────────────────────────
function TasteStep({
  gender,
  selectedBrands,
  onToggleBrand,
  searchQuery,
  onChangeSearch,
}: {
  gender: Gender;
  selectedBrands: Set<string>;
  onToggleBrand: (brand: string) => void;
  searchQuery: string;
  onChangeSearch: (q: string) => void;
}) {
  const gridBrands = useMemo(() => (gender ? getRepBrands(gender) : []), [gender]);
  const searchPool = useMemo(() => (gender ? getSearchPool(gender) : []), [gender]);
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchPool.filter((brand) => brand.toLowerCase().includes(q)).slice(0, MAX_SEARCH_RESULTS);
  }, [searchPool, searchQuery]);

  // 스크롤 하단 경계 페이드 — 칩이 하드 클립되지 않고 배경으로 녹아들게.
  // 주의: 웹 프리뷰는 IOSColors 폴백이 고정 라이트라서 OS 스킴과 무관하게
  // 항상 라이트 페이드를 쓴다. 네이티브에서만 스킴을 따른다.
  const scheme = useColorScheme();
  const isDarkBg = Platform.OS !== 'web' && scheme === 'dark';
  const fadeEdge = isDarkBg ? '#000000' : '#FFFFFF';
  const fadeClear = isDarkBg ? 'rgba(0,0,0,0)' : 'rgba(255,255,255,0)';

  return (
    <View style={styles.stepBody}>
      {/* HIG 정합 — 카운터·상단 Skip 없음. 진행 상태는 칩 선택 표시와
          CTA 라벨 전환("N개 더 골라주세요" → "다음")로만 전달. */}
      <Text style={styles.stepTitle}>어떤 브랜드를 좋아하세요?</Text>
      <Text style={styles.stepSubtitle}>여기서부터 취향을 맞춰갈게요</Text>

      {/* 검색창은 스크롤 밖 고정 — 그리드를 아무리 내려도 항상 그 자리.
          실서비스는 GET /v1/brands/search, 프로토타입은 로컬 스냅샷 매치. */}
      <GlassSurface {...Glass.composer} style={styles.searchField}>
        {Platform.OS !== 'web' && (
          <SymbolView name="magnifyingglass" size={16} tintColor={IOSColors.secondaryLabel} weight="regular" />
        )}
        <TextInput
          value={searchQuery}
          onChangeText={onChangeSearch}
          placeholder="좋아하는 브랜드를 검색해보세요"
          placeholderTextColor={IOSColors.placeholderText}
          style={styles.searchInput}
        />
      </GlassSurface>

      {searchResults.length > 0 && (
        <View style={styles.searchResultsRow}>
          {searchResults.map((brand) => (
            <SearchResultChip
              key={brand}
              label={brand}
              selected={selectedBrands.has(brand)}
              onPress={() => onToggleBrand(brand)}
            />
          ))}
        </View>
      )}

      <View style={styles.tasteScrollFrame}>
      <ScrollView
        style={styles.tasteScroll}
        contentContainerStyle={styles.tasteScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandGrid}>
          {gridBrands.map((brand, i) => (
            <BrandChip
              key={brand}
              label={brand}
              tint={NODE_CHIP_TINTS[i % NODE_CHIP_TINTS.length]}
              selected={selectedBrands.has(brand)}
              onPress={() => onToggleBrand(brand)}
            />
          ))}
        </View>
      </ScrollView>
      {/* 상(검색창 아래)·하(CTA 위) 경계 페이드 오버레이 — 터치는 통과 */}
      <LinearGradient
        pointerEvents="none"
        colors={[fadeEdge, fadeClear]}
        style={[styles.scrollFade, styles.scrollFadeTop]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[fadeClear, fadeEdge]}
        style={[styles.scrollFade, styles.scrollFadeBottom]}
      />
      </View>
    </View>
  );
}

// [시안용 로컬 팔레트 — 확정 시 theme/brand.ts 토큰으로 승격할 것]
// 선택 필 컬러를 노드(그리드 순서)별로 로테이션 — 여러 개 고르면 파스텔
// 스티커들이 구름 사이에 박히는 그림. 피치(브랜드)를 1번으로 두고 나머지는
// 피치와 톤이 맞는 파스텔 계열만.
const NODE_CHIP_TINTS = [
  BrandColors.peach[300], // 피치 (브랜드)
  '#F5D98F', // 버터 옐로
  '#BFDCB6', // 세이지 그린
  '#AFCBEA', // 페일 블루
  '#DBC5EC', // 라일락
  '#F4C2D2', // 로즈 핑크
  '#B9E0D4', // 민트
] as const;

function BrandChip({
  label,
  tint,
  selected,
  onPress,
}: {
  label: string;
  tint?: string;
  selected: boolean;
  onPress: () => void;
}) {
  // 태그 클라우드 필 — 글래스가 아니라 플랫 스티커 무드(레퍼런스: 아웃라인 필,
  // 선택 시 컬러 필). 선택 칩에만 얕은 그림자를 줘 "붙인 스티커" 질감을 낸다.
  // 상태 표현이 필 자체라 체크마크는 두지 않는다.
  // 기본 상태부터 연한 파스텔 필이 깔리고, 선택하면 같은 색이 진해지며
  // 그림자가 붙는다 — 색 = 정체성, 진하기 = 선택 상태.
  const chipTint = tint ?? BrandRole.primary;
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={[
            styles.brandChip,
            { backgroundColor: withAlpha(chipTint, Opacity.faint) },
            selected && styles.brandChipSelected,
            selected && { backgroundColor: chipTint },
            pressed && styles.brandChipPressed,
          ]}
        >
          <Text style={[styles.brandChipText, selected && styles.brandChipTextSelected]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

// 검색 결과 칩 — 그리드 칩보다 한 단계 작은 서브 칩. 탭 시 그리드와 동일한
// selectedBrands 상태로 합류(toggleBrand 재사용)한다.
function SearchResultChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={[
            styles.searchResultChip,
            selected && styles.brandChipSelected,
            pressed && styles.brandChipPressed,
          ]}
        >
          <Text
            style={[styles.searchResultChipText, selected && styles.brandChipTextSelected]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </View>
      )}
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
  selectedBrands,
  insets,
  onReset,
}: {
  gender: Gender;
  selectedBrands: Set<string>;
  insets: EdgeInsets;
  onReset: () => void;
}) {
  const brandList = useMemo(() => Array.from(selectedBrands), [selectedBrands]);
  const nodeIds = useMemo(() => mapBrandsToNodeIds(selectedBrands, gender), [selectedBrands, gender]);
  const genderLabel = gender === 'women' ? '여성복' : gender === 'men' ? '남성복' : '미선택';

  return (
    <View style={[styles.doneWrap, { paddingTop: insets.top + Spacing.six }]}>
      <Text style={styles.doneTitle}>온보딩 완료 (mock)</Text>

      <View style={styles.doneRow}>
        <Text style={styles.doneLabel}>성별</Text>
        <Text style={styles.doneValue}>{genderLabel}</Text>
      </View>
      <View style={styles.doneRow}>
        <Text style={styles.doneLabel}>선택 브랜드 ({brandList.length})</Text>
        <Text style={styles.doneValue}>{brandList.length > 0 ? brandList.join(', ') : '없음'}</Text>
      </View>
      <View style={styles.doneRow}>
        <Text style={styles.doneLabel}>매핑된 노드 id</Text>
        <Text style={styles.doneValue}>{nodeIds.length > 0 ? nodeIds.join(', ') : '없음'}</Text>
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
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.five,
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
  // 손+텍스트 그룹이 상단 ~30% 지점에서 시작하도록 하는 비율 (0.45:1.05).
  // 손-텍스트 간격은 flex 가 아니라 타이틀 marginTop 으로 고정(밀착).
  welcomeTopSpacer: {
    flex: 0.38,
  },
  welcomeMidSpacer: {
    flex: 1.2,
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
  // 글래스 캡슐 칩 — 위아래 1개씩. 취향 칩과 같은 캡슐 문법, 소재만 글래스.
  genderCard: {
    // 다이나믹 타입 확대 시 라벨이 잘리지 않게 min 만 고정.
    minHeight: GENDER_CARD_HEIGHT,
    borderRadius: GENDER_CARD_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  // 선택 = 블랙 필 (label 토큰 — 라이트=검정/다크=흰색, CTA 버튼과 동일 문법).
  genderCardTint: {
    ...StyleSheet.absoluteFill,
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
  // 스크롤 프레임 — 페이드 오버레이의 absolute 기준.
  tasteScrollFrame: {
    flex: 1,
    marginTop: Spacing.four,
  },
  scrollFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    zIndex: 1,
  },
  scrollFadeTop: {
    top: 0,
  },
  scrollFadeBottom: {
    bottom: 0,
  },
  tasteScroll: {
    flex: 1,
  },
  tasteScrollContent: {
    paddingBottom: Spacing.six,
  },
  // 태그 클라우드 — 좌측 정렬 (히어로·타이틀과 같은 좌측 레일에 맞춘다).
  brandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: Spacing.two + Spacing.half,
  },
  // 기본 = 아웃라인 필(투명 배경 + 헤어라인), 선택 = 피치 필 + 얕은 그림자.
  // 완전 캡슐이 되도록 radius 는 높이 절반보다 크게.
  // 필 컬러는 렌더에서 노드별 tint 로 주입 — 여기는 형태만.
  brandChip: {
    minHeight: BRAND_CHIP_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four - Spacing.half,
    borderRadius: BRAND_CHIP_HEIGHT,
  },
  brandChipSelected: {
    borderColor: 'transparent',
    backgroundColor: BrandRole.primary,
    ...Elevation.raised,
  },
  brandChipPressed: {
    opacity: Opacity.softened,
  },
  brandChipText: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  brandChipTextSelected: {
    // 파스텔 필 위에서 항상 대비가 서는 딥 브라운 (피치 스케일 최심부).
    color: BrandColors.peach[900],
    fontWeight: '700',
  },

  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    borderRadius: RadiusRole.field,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.four,
    overflow: 'hidden',
  },
  searchInput: {
    ...IOSText.body,
    flex: 1,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  searchResultsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  searchResultChip: {
    minHeight: SEARCH_CHIP_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: SEARCH_CHIP_HEIGHT,
    borderWidth: 1.5,
    borderColor: IOSColors.opaqueSeparator,
    backgroundColor: 'transparent',
  },
  // 그리드 칩(headline)의 한 단계 아래 — 보조 칩은 subhead 로 통일.
  searchResultChipText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
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
