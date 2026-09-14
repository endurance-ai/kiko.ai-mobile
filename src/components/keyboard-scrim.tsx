import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { withAlpha } from '@/theme';

// 최초 랜딩(Auto Keyboard) 흰 그라데이션 모음 — 배경 콘텐츠를 헤더/컴포저와
// 부드럽게 격리한다.
//
// 색은 PlatformColor(systemBackground)를 alpha 로 못 감싸므로(withAlpha 불가)
// systemBackground 의 양 끝값(라이트 #FFF / 다크 #000)을 스킴별로 골라
// withAlpha 로 rgba 화한다. 완전 매끄러운 2D/부분투명은 View opacity 밴드로는
// 경계가 두드러져 expo-linear-gradient 를 쓴다.

/** 스킴별 systemBackground 양 끝값. */
function useBase(): string {
  return useColorScheme() === 'dark' ? '#000000' : '#FFFFFF';
}

// ── 컴포저 스크림 (하단) ────────────────────────────────────────────────────
//
// 세로: 위는 투명, 아래로 갈수록 불투명 → solidHeight 구간은 완전(흰) 불투명.
//   페이드 곡선은 Figma 원본 형태(#FFF0 0% → 0.6 12% → 0.94 26% → #FFF 38%),
//   38% 이후는 solid. 페이드 높이(fadeHeight)를 고정 px 로 둬 키보드가 열려도
//   낮게 유지한다. 호출부는 fadeHeight 를 "위 두 칩 높이 + 여유"로, solidHeight
//   를 "사진 칩부터 아래(+키보드)"로 줘, 사진 칩부터는 흰색으로 떨어진다.
//
// 가로: 왼쪽(칩)은 불투명, 오른쪽은 페이드 구간에서만 더 투명 — 바닥(solid)은
//   모든 컬럼이 흰색이라 seam 이 없다. 세로 그라데이션 컬럼의 stop alpha 를
//   a(v)=v·(1−RIGHT_DROP·h·(1−v)) 로 계산(h=컬럼 위치 0..1). v=1(solid)이면
//   항상 1 → 흰색. 페이드 중간(v<1)에서만 오른쪽이 내려간다.

// 가로 컬럼 수 — 많을수록 가로가 매끄럽다.
const COLS = 24;
// 세로 페이드 스톱 수 — smootherstep 곡선 근사(많을수록 매끄럽다).
const FADE_STEPS = 16;

type KeyboardScrimProps = {
  /** 완전(흰) 불투명으로 덮을 하단 높이 = 키보드 + (사진 칩부터 아래) 구간. */
  solidHeight: number;
  /** 그 위 투명→불투명 페이드 높이(pt). 위 두 칩 + 여유. */
  fadeHeight?: number;
  /** 바닥(solid) 최대 불투명도 — 완전 흰색이 아니라 살짝 비친다. 기본 0.9. */
  peak?: number;
  /** 오른쪽이 페이드 구간에서 얼마나 더 투명해지는지(0=가로 균일=헤더처럼).
   *  키보드 열림(칩 노출) 시엔 0.6, 닫힘 시엔 0 을 준다. 기본 0.6. */
  rightDrop?: number;
};

export function KeyboardScrim({
  solidHeight,
  fadeHeight = 120,
  peak = 0.9,
  rightDrop = 0.6,
}: KeyboardScrimProps) {
  const base = useBase();
  if (solidHeight <= 0) return null;

  const total = solidHeight + fadeHeight;
  const f = fadeHeight / total; // 페이드가 전체에서 차지하는 비율.

  return (
    <View
      style={[styles.composerWrap, { height: total }]}
      pointerEvents="none"
    >
      {Array.from({ length: COLS }).map((_, c) => {
        const h = c / (COLS - 1); // 0=왼, 1=오른.
        // peak 로 바닥을 살짝 투명하게(헤더 톤). v=1 → peak, v=0 → 0.
        const a = (v: number) => peak * v * (1 - rightDrop * h * (1 - v));
        // 세로 페이드는 헤더와 동일한 smootherstep — 맨 위는 기울기 0이라
        // (거의 100%) 투명하게 시작해 아래로 자연스럽게 peak 까지 진해진다.
        const locations: [number, number, ...number[]] = [
          0,
          f * (1 / FADE_STEPS),
        ];
        const colors: [string, string, ...string[]] = [
          withAlpha(base, a(smootherstep(0))), // 0 (완전 투명)
          withAlpha(base, a(smootherstep(1 / FADE_STEPS))),
        ];
        for (let i = 2; i <= FADE_STEPS; i++) {
          const t = i / FADE_STEPS;
          locations.push(f * t);
          colors.push(withAlpha(base, a(smootherstep(t))));
        }
        // 페이드 아래(solid)는 바닥까지 peak 유지.
        locations.push(1);
        colors.push(withAlpha(base, peak));
        return (
          <LinearGradient
            key={c}
            colors={colors}
            locations={locations}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.col}
          />
        );
      })}
    </View>
  );
}

// ── 헤더 스크림 (상단) ──────────────────────────────────────────────────────
//
// 위(상태바/헤더)는 불투명, 아래로 갈수록 투명 — 스크롤 콘텐츠가 헤더 밑으로
// 지나가도 아이콘/타이틀이 읽힌다. 가로 차이 없음(단일 그라데이션).

// smootherstep — 양 끝 기울기가 0이라 이어붙일 때 꺾임(경계)이 안 생긴다.
function smootherstep(u: number): number {
  return u * u * u * (u * (u * 6 - 15) + 10);
}

type HeaderScrimProps = {
  /** 스크림 전체 높이 = 안전영역 + 헤더. */
  height: number;
  /** 상단 최대 불투명도(<1 이면 헤더도 반투명). 기본 0.8. */
  peak?: number;
  /** 스톱 수 — 많을수록 매끄럽다. 기본 20. */
  steps?: number;
};

export function HeaderScrim({ height, peak = 0.8, steps = 20 }: HeaderScrimProps) {
  const base = useBase();
  if (height <= 0) return null;
  // 전체 높이를 smootherstep 로 peak(위) → 0(아래) 이징. 평평 구간 없이
  // 곡선이 전 구간을 담당하고 양 끝 기울기가 0이라 경계(꺾임)가 안 보인다.
  // smootherstep 은 초반이 완만해 상단(헤더 아이콘)은 peak 근처로 유지된다.
  const locations: [number, number, ...number[]] = [0, 1 / steps];
  const colors: [string, string, ...string[]] = [
    withAlpha(base, peak),
    withAlpha(base, peak * (1 - smootherstep(1 / steps))),
  ];
  for (let i = 2; i <= steps; i++) {
    const t = i / steps;
    locations.push(t);
    colors.push(withAlpha(base, peak * (1 - smootherstep(t))));
  }
  return (
    <LinearGradient
      colors={colors}
      locations={locations}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[styles.headerWrap, { height }]}
      pointerEvents="none"
    />
  );
}

const styles = StyleSheet.create({
  composerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    // 스크롤 콘텐츠(z0) 위, 컴포저 float(z40) 아래.
    zIndex: 35,
  },
  col: {
    flex: 1,
    height: '100%',
  },
  headerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    // 스크롤 콘텐츠(z0) 위, TopBar float(z50) 아래.
    zIndex: 45,
  },
});
