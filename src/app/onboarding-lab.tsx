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
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { GlassSurface } from '@/components/glass-surface';
import { STYLE_NODES } from '@/state/style-nodes';
import {
  BrandColors,
  BrandGradient,
  BrandRole,
  Duration,
  Glass,
  Haptic,
  IOSColors,
  IOSFont,
  IOSText,
  Opacity,
  Radius,
  RadiusRole,
  withAlpha,
} from '@/theme';

// 구 Spacing 토큰 값 (main Phase 2 dead-code 제거로 theme에서 삭제됨) —
// curation-lab.tsx 와 동일하게 프로토타입 로컬로 재도입.
const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

type Step = 'welcome' | 'gender' | 'taste' | 'done';
type Gender = 'women' | 'men' | null;

// ── 레이아웃 상수 (구조적 수치 — 하드코딩 예외 대상) ───────────────────────
const HEADER_SIDE_SLOT = 32;
const KIKO_BLOB_SIZE = 180;
const GENDER_CARD_HEIGHT = 64;
const BRAND_CHIP_HEIGHT = 40;
const SEARCH_CHIP_HEIGHT = 32;
const MAX_SEARCH_RESULTS = 8;
// 성별 카드 선택 → 다음 스텝 자동 진입까지의 유예(스펙 300ms) — 선택 표시가
// 눈에 보일 최소한의 시간만 주고 바로 넘어간다.
const GENDER_AUTO_ADVANCE_DELAY = 300;

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

  // 성별 선택 후 자동 진입 타이머 — 스텝을 벗어나거나 언마운트되면 정리.
  const genderAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (genderAdvanceRef.current) clearTimeout(genderAdvanceRef.current);
    },
    [],
  );

  // 스텝 전환 애니메이션 — 새 스텝 콘텐츠가 opacity 0→1 + translateY 8→0 로
  // 은은하게 나타난다. 트리거성 withTiming (진입/이탈이지 제스처가 아니므로
  // Motion 스프링이 아니라 Duration 계열이 맞다 — docs/design-system.md 규칙4).
  const contentOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(8);
  useEffect(() => {
    contentOpacity.value = 0;
    contentTranslateY.value = 8;
    contentOpacity.value = withTiming(1, { duration: Duration.base });
    contentTranslateY.value = withTiming(0, { duration: Duration.base });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentTranslateY.value }],
  }));

  const handleBack = () => {
    Haptic.light();
    if (step === 'gender') setStep('welcome');
    else if (step === 'taste') setStep('gender');
  };

  const handleSelectGender = (next: 'women' | 'men') => {
    Haptic.selection();
    setGender(next);
    genderAdvanceRef.current = setTimeout(() => {
      setStep('taste');
    }, GENDER_AUTO_ADVANCE_DELAY);
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
    if (genderAdvanceRef.current) clearTimeout(genderAdvanceRef.current);
    setStep('welcome');
    setGender(null);
    setSelectedBrands(new Set());
    setSearchQuery('');
  };

  return (
    <View style={styles.root}>
      {/* 뒤로가기 + 진행 인디케이터 — done 스텝(요약 화면)에서는 숨긴다 */}
      {step !== 'done' && (
        <View style={[styles.header, { paddingTop: insets.top + Spacing.two }]}>
          {step !== 'welcome' ? (
            <Pressable hitSlop={8} onPress={handleBack} style={styles.headerSideSlot}>
              <SymbolView name="chevron.left" size={20} tintColor={IOSColors.label} weight="medium" />
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
        {step === 'gender' && <GenderStep gender={gender} onSelect={handleSelectGender} />}
        {step === 'taste' && (
          <TasteStep
            gender={gender}
            selectedBrands={selectedBrands}
            onToggleBrand={toggleBrand}
            searchQuery={searchQuery}
            onChangeSearch={setSearchQuery}
            onSkip={() => {
              Haptic.light();
              setStep('done');
            }}
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
          <PrimaryButton label="다음" onPress={() => setStep('gender')} />
        </View>
      )}
      {step === 'taste' && (
        <View style={[styles.ctaArea, { paddingBottom: insets.bottom + Spacing.three }]}>
          <PrimaryButton
            label={
              selectedBrands.size > 0
                ? `${selectedBrands.size}개 선택 · 시작하기`
                : '건너뛰고 시작하기'
            }
            onPress={() => setStep('done')}
          />
        </View>
      )}
    </View>
  );
}

// ── ProgressDots — 상단 점 3개 ───────────────────────────────────────────
const STEP_ORDER: Exclude<Step, 'done'>[] = ['welcome', 'gender', 'taste'];

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
function PrimaryButton({ label, onPress }: { label: string; onPress: () => void }) {
  const handlePress = () => {
    Haptic.medium();
    onPress();
  };
  return (
    <Pressable onPress={handlePress} style={styles.ctaButton}>
      <Text style={styles.ctaButtonText}>{label}</Text>
    </Pressable>
  );
}

// ── KikoBlob — 웰컴 스텝 중앙 오브젝트 ────────────────────────────────────
// 표정/디테일 없이, 피치 그라데이션 원형 3겹을 옅은 opacity 로 겹쳐 소프트한
// 오라만 표현한다 (Lóvi 레퍼런스 무드 — 미니멀). BrandGradient.loginMarquee
// 와 BrandColors.peach 스케일만 사용, 리터럴 색상 없음.
function KikoBlob() {
  return (
    <View style={styles.blobContainer}>
      <LinearGradient
        colors={[BrandColors.peach[100], BrandColors.peach[400]]}
        style={[styles.blobLayer, styles.blobLayerOuter]}
      />
      <LinearGradient colors={BrandGradient.loginMarquee} style={[styles.blobLayer, styles.blobLayerMid]} />
      <LinearGradient
        colors={[BrandColors.peach[200], BrandColors.peach[500]]}
        style={[styles.blobLayer, styles.blobLayerInner]}
      />
    </View>
  );
}

// ── WelcomeStep ──────────────────────────────────────────────────────────
function WelcomeStep() {
  return (
    <View style={styles.welcomeWrap}>
      <KikoBlob />
      <Text style={styles.welcomeTitle}>안녕하세요, 키코예요 👋</Text>
      <Text style={styles.welcomeSubtitle}>
        무신사에 없는 5,000개 브랜드에서{'\n'}머릿속 그 옷을 찾아드려요
      </Text>
    </View>
  );
}

// ── GenderStep ───────────────────────────────────────────────────────────
// 카드 탭 → selection 햅틱 + 선택 표시 → 300ms 뒤 자동으로 taste 스텝 진입
// (별도 CTA 없음, 부모의 handleSelectGender 가 타이머를 관리).
function GenderStep({
  gender,
  onSelect,
}: {
  gender: Gender;
  onSelect: (next: 'women' | 'men') => void;
}) {
  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepTitle}>어떤 옷을 보여드릴까요?</Text>
      <Text style={styles.stepSubtitle}>언제든 설정에서 바꿀 수 있어요</Text>

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
            머지해 backgroundColor/border 를 우리 style prop 으로 덮어쓰기
            어렵다 — 선택 강조는 children 으로 얹는 반투명 틴트 오버레이로
            그린다 (children 은 항상 배경 위에 그려지므로 안전). */}
        {selected && <View pointerEvents="none" style={styles.genderCardTint} />}
        <Text style={[styles.genderCardText, selected && styles.genderCardTextSelected]}>
          {label}
        </Text>
        {selected && (
          <SymbolView
            name="checkmark"
            size={14}
            tintColor={BrandRole.deep}
            weight="bold"
            style={styles.genderCardCheck}
          />
        )}
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
  onSkip,
}: {
  gender: Gender;
  selectedBrands: Set<string>;
  onToggleBrand: (brand: string) => void;
  searchQuery: string;
  onChangeSearch: (q: string) => void;
  onSkip: () => void;
}) {
  const gridBrands = useMemo(() => (gender ? getRepBrands(gender) : []), [gender]);
  const searchPool = useMemo(() => (gender ? getSearchPool(gender) : []), [gender]);
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchPool.filter((brand) => brand.toLowerCase().includes(q)).slice(0, MAX_SEARCH_RESULTS);
  }, [searchPool, searchQuery]);

  return (
    <View style={styles.stepBody}>
      <View style={styles.tasteHeaderRow}>
        <Text style={[styles.stepTitle, styles.tasteTitle]}>평소 좋아하는 브랜드가 있나요?</Text>
        <Pressable hitSlop={8} onPress={onSkip}>
          <Text style={styles.skipText}>건너뛰기</Text>
        </Pressable>
      </View>
      <Text style={styles.stepSubtitle}>취향에 맞는, 당신이 몰랐던 브랜드를 찾아드려요</Text>
      <Text style={styles.tasteHint}>나중에 메인에서도 설정할 수 있어요</Text>

      <ScrollView
        style={styles.tasteScroll}
        contentContainerStyle={styles.tasteScrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brandGrid}>
          {gridBrands.map((brand) => (
            <BrandChip
              key={brand}
              label={brand}
              selected={selectedBrands.has(brand)}
              onPress={() => onToggleBrand(brand)}
            />
          ))}
        </View>

        <Text style={styles.searchSectionHint}>
          여기 없는 브랜드도 괜찮아요 — 5,000개 중에서 찾아보세요
        </Text>
        {/* 실서비스는 GET /v1/brands/search — 프로토타입은 STYLE_NODES 로컬
            스냅샷(repBrand + sampleBrands)에서만 대소문자 무시 substring 매치. */}
        <GlassSurface {...Glass.composer} style={styles.searchField}>
          <SymbolView name="magnifyingglass" size={16} tintColor={IOSColors.secondaryLabel} weight="regular" />
          <TextInput
            value={searchQuery}
            onChangeText={onChangeSearch}
            placeholder="브랜드 검색"
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
      </ScrollView>
    </View>
  );
}

function BrandChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <View style={[styles.brandChipRing, selected && styles.brandChipRingSelected]}>
      <Pressable onPress={onPress}>
        <GlassSurface {...Glass.chip} isInteractive style={styles.brandChip}>
          {selected && <View pointerEvents="none" style={styles.brandChipTint} />}
          <Text style={[styles.brandChipText, selected && styles.brandChipTextSelected]} numberOfLines={1}>
            {label}
          </Text>
          {selected && (
            <SymbolView name="checkmark" size={12} tintColor={BrandRole.deep} weight="bold" />
          )}
        </GlassSurface>
      </Pressable>
    </View>
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
      <GlassSurface {...Glass.chip} isInteractive style={styles.searchResultChip}>
        {selected && <View pointerEvents="none" style={styles.brandChipTint} />}
        <Text
          style={[styles.searchResultChipText, selected && styles.brandChipTextSelected]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </GlassSurface>
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
  ctaButton: {
    width: '100%',
    minHeight: 52,
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
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  blobContainer: {
    width: KIKO_BLOB_SIZE,
    height: KIKO_BLOB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.five,
  },
  blobLayer: {
    position: 'absolute',
    borderRadius: Radius.pill,
  },
  blobLayerOuter: {
    width: KIKO_BLOB_SIZE,
    height: KIKO_BLOB_SIZE,
    opacity: Opacity.muted,
  },
  blobLayerMid: {
    width: KIKO_BLOB_SIZE * 0.78,
    height: KIKO_BLOB_SIZE * 0.78,
    opacity: Opacity.softened,
  },
  blobLayerInner: {
    width: KIKO_BLOB_SIZE * 0.52,
    height: KIKO_BLOB_SIZE * 0.52,
    opacity: Opacity.nearFull,
  },
  welcomeTitle: {
    ...IOSText.title1,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
    textAlign: 'center',
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
  genderCard: {
    height: GENDER_CARD_HEIGHT,
    borderRadius: RadiusRole.card,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  genderCardTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(BrandColors.peach[300], 0.22),
  },
  genderCardText: {
    ...IOSText.headline,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  genderCardTextSelected: {
    color: BrandRole.deep,
  },
  genderCardCheck: {
    position: 'absolute',
    right: Spacing.four,
  },

  // ── 취향 스텝 ──
  tasteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  tasteTitle: {
    flex: 1,
  },
  skipText: {
    ...IOSText.subhead,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: 2,
  },
  tasteHint: {
    ...IOSText.footnote,
    color: IOSColors.tertiaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.one,
  },
  tasteScroll: {
    flex: 1,
    marginTop: Spacing.four,
  },
  tasteScrollContent: {
    paddingBottom: Spacing.six,
  },
  brandGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  brandChipRing: {
    borderRadius: RadiusRole.chip + 2,
    borderWidth: 0,
    borderColor: 'transparent',
  },
  brandChipRingSelected: {
    borderWidth: 1.5,
    borderColor: BrandRole.primary,
  },
  brandChip: {
    height: BRAND_CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: RadiusRole.chip,
    overflow: 'hidden',
  },
  brandChipTint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: withAlpha(BrandColors.peach[300], 0.2),
  },
  brandChipText: {
    ...IOSText.subhead,
    color: IOSColors.label,
    fontFamily: IOSFont.sans,
  },
  brandChipTextSelected: {
    color: BrandRole.deep,
    fontWeight: '600',
  },

  searchSectionHint: {
    ...IOSText.footnote,
    color: IOSColors.secondaryLabel,
    fontFamily: IOSFont.sans,
    marginTop: Spacing.five,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    borderRadius: RadiusRole.field,
    paddingHorizontal: Spacing.three,
    marginTop: Spacing.two,
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
    height: SEARCH_CHIP_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    borderRadius: RadiusRole.chip,
    overflow: 'hidden',
  },
  searchResultChipText: {
    ...IOSText.footnote,
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
