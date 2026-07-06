import { ReactNode, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  StyleProp,
  StyleSheet,
  TextStyle,
  useColorScheme,
  View,
} from "react-native";

/**
 * PixelSpinner — 3x3 pixel loader for AI agent status.
 *
 * React Native port of the web PixelSpinner.tsx. Uses Animated per-cell
 * opacity to reproduce the fade-in / fade-out trail. Glow is approximated
 * via native shadow (iOS) — CSS `filter: drop-shadow(...)` has no direct
 * equivalent, but per-pixel shadow reads close enough on device.
 */

export type PixelSpinnerMode = "dark" | "light";

export type PixelSpinnerVariant =
  | "emanating"
  | "streaming"
  | "rotating"
  | "syncing"
  | "wiping"
  | "rising";

// Each frame is 9 chars (row-major). "1" = lit, "0" = dim.
const PATTERNS: Record<PixelSpinnerVariant, string[]> = {
  emanating: [
    "000010000",
    "010111010",
    "111111111",
    "101000101",
    "000000000",
  ],
  streaming: [
    "100000000",
    "010100000",
    "001010100",
    "000001010",
    "000000001",
    "000000000",
  ],
  rotating: [
    "111000000",
    "011001000",
    "001001001",
    "000001011",
    "000000111",
    "000100110",
    "100100100",
    "110100000",
  ],
  syncing: ["100000001", "010000010", "001000100", "000101000"],
  wiping: [
    "000000000",
    "100100100",
    "110110110",
    "111111111",
    "011011011",
    "001001001",
    "000000000",
  ],
  rising: [
    "010000100",
    "000100000",
    "100000001",
    "000001000",
    "001000010",
    "000010000",
  ],
};

export const PIXEL_SPINNER_VARIANTS: PixelSpinnerVariant[] = [
  "emanating",
  "streaming",
  "rotating",
  "syncing",
  "wiping",
  "rising",
];

export function randomPixelSpinnerVariant(): PixelSpinnerVariant {
  return PIXEL_SPINNER_VARIANTS[
    Math.floor(Math.random() * PIXEL_SPINNER_VARIANTS.length)
  ];
}

const FPS = 7;
const FRAME_MS = 1000 / FPS;
const ON_OPACITY = 1;
const OFF_OPACITY = 0.16;
const FADE_IN_MS = 220;
const FADE_OUT_MS = 720;

// Dark 모드: pale amber core + 강한 warm glow (dark bg 위에서 additive 로 번짐).
const DARK = {
  core: "#FFD7A8",
  shadowColor: "#FF7A29",
  shadowRadius: 6,
  shadowOpacity: 0.9,
} as const;
// Light 모드: saturated orange core + 은은한 halo (white bg 위 subtractive 대응).
const LIGHT = {
  core: "#F97316",
  shadowColor: "#FDBA74",
  shadowRadius: 3,
  shadowOpacity: 0.5,
} as const;

export interface PixelSpinnerProps {
  mode?: PixelSpinnerMode;
  variant?: PixelSpinnerVariant;
  /** Pixel edge length in px. Total grid = pixelSize * 3. Default 6. */
  pixelSize?: number;
}

export function PixelSpinner({
  mode,
  variant,
  pixelSize = 6,
}: PixelSpinnerProps) {
  const scheme = useColorScheme();
  const resolvedMode: PixelSpinnerMode =
    mode ?? (scheme === "dark" ? "dark" : "light");
  const palette = resolvedMode === "dark" ? DARK : LIGHT;

  // variant 미지정 시 마운트 시점에 랜덤 하나 고정 (재렌더로 안 바뀜).
  const resolvedVariant = useMemo<PixelSpinnerVariant>(
    () => variant ?? randomPixelSpinnerVariant(),
    [variant],
  );
  const frames = PATTERNS[resolvedVariant];

  // 9 셀 각각의 opacity Animated.Value. 초기값은 OFF.
  const opacities = useRef<Animated.Value[]>(
    Array.from({ length: 9 }, () => new Animated.Value(OFF_OPACITY)),
  ).current;
  const lit = useRef<boolean[]>(Array(9).fill(false)).current;

  useEffect(() => {
    // frames/variant 바뀔 때 상태 리셋.
    for (let i = 0; i < 9; i++) {
      lit[i] = false;
      opacities[i].setValue(OFF_OPACITY);
    }
    let f = 0;
    const id = setInterval(() => {
      const bits = frames[f % frames.length];
      for (let i = 0; i < 9; i++) {
        const wasLit = lit[i];
        const willLight = bits[i] === "1";
        if (willLight && !wasLit) {
          Animated.timing(opacities[i], {
            toValue: ON_OPACITY,
            duration: FADE_IN_MS,
            useNativeDriver: true,
          }).start();
        } else if (!willLight && wasLit) {
          Animated.timing(opacities[i], {
            toValue: OFF_OPACITY,
            duration: FADE_OUT_MS,
            useNativeDriver: true,
          }).start();
        }
        lit[i] = willLight;
      }
      f++;
    }, FRAME_MS);
    return () => clearInterval(id);
  }, [frames, opacities, lit]);

  return (
    <View
      style={[
        styles.grid,
        { width: pixelSize * 3, height: pixelSize * 3 },
      ]}
    >
      {Array.from({ length: 9 }).map((_, i) => (
        <Animated.View
          key={i}
          style={{
            width: pixelSize,
            height: pixelSize,
            backgroundColor: palette.core,
            opacity: opacities[i],
            shadowColor: palette.shadowColor,
            shadowRadius: palette.shadowRadius,
            shadowOpacity: palette.shadowOpacity,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
});

// ─── ShimmerText ──────────────────────────────────────────────────────────
// Claude Code 대기 멘트 스타일 — 밝은 하이라이트가 왼쪽 → 오른쪽으로 스쳐 지남.
// 각 글자에 스태거된 interpolate 를 걸어 wave 형태의 스윕 효과 재현.

// 한 번 스윕에 걸리는 시간. 텍스트가 길어도 sweep 자체 속도는 유지 — 대신
// 텍스트 길이에 비례해 하이라이트가 실제로 지나가는 구간이 넓어짐.
const SHIMMER_SWEEP_MS = 1600;
// 하이라이트가 각 글자를 밝히는 창 폭 (0~1 스케일).
const SHIMMER_PEAK_WIDTH = 0.22;
// 스윕 뒤 잠깐 쉬어가는 idle 구간 (0~1 스케일). 반복이 지루하지 않도록.
const SHIMMER_IDLE_TAIL = 0.35;

// [dim, bright] 팔레트 — light: 진한 검정에 가까운 label 정점, dark: 흰색 정점.
const LIGHT_SHIMMER = ["rgba(60,60,67,0.55)", "rgba(20,20,25,1)"] as const;
const DARK_SHIMMER = ["rgba(235,235,245,0.55)", "rgba(255,255,255,1)"] as const;

export interface ShimmerTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  /** 명시하지 않으면 useColorScheme 로 자동 감지. */
  mode?: PixelSpinnerMode;
  /** [dim, bright] 두 색을 override. */
  colors?: readonly [string, string];
}

export function ShimmerText({
  children,
  style,
  mode,
  colors,
}: ShimmerTextProps) {
  const scheme = useColorScheme();
  const resolvedMode: PixelSpinnerMode =
    mode ?? (scheme === "dark" ? "dark" : "light");
  const [dim, bright] = colors ?? (resolvedMode === "dark" ? DARK_SHIMMER : LIGHT_SHIMMER);

  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    anim.setValue(0);
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: SHIMMER_SWEEP_MS,
        // color interpolation 은 native driver 로 못 굴린다 → JS thread.
        useNativeDriver: false,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  // 텍스트를 글자 배열로 쪼개 각 글자에 개별 interpolate 를 걸어 wave 재현.
  // 첫 글자는 anim=0 근처에서 정점 → 마지막 글자는 anim=(1-idle) 근처에서 정점.
  const chars = useMemo(() => Array.from(children ?? ""), [children]);
  const sweepEnd = 1 - SHIMMER_IDLE_TAIL;

  return (
    <Animated.Text style={[style, { color: dim }]}>
      {chars.map((ch, i) => {
        // 이 글자가 최대 밝기가 되는 anim 값.
        const peak =
          chars.length > 1 ? (i / (chars.length - 1)) * sweepEnd : sweepEnd * 0.5;
        const start = Math.max(0, peak - SHIMMER_PEAK_WIDTH);
        const end = Math.min(1, peak + SHIMMER_PEAK_WIDTH);
        // input range 는 반드시 오름차순 + 중복 없이. peak==start / peak==end
        // 인 엣지 글자는 두 지점만 사용해서 자연스럽게 감쇠.
        const inputRange: number[] = [];
        const outputRange: string[] = [];
        if (start > 0) {
          inputRange.push(0, start);
          outputRange.push(dim, dim);
        } else {
          inputRange.push(0);
          outputRange.push(dim);
        }
        // peak 은 start / end 와 중복될 수 있으니 살짝 밀어냄.
        const safePeak = Math.min(end, Math.max(start, peak));
        if (safePeak > (inputRange[inputRange.length - 1] ?? -1)) {
          inputRange.push(safePeak);
          outputRange.push(bright);
        }
        if (end > safePeak) {
          inputRange.push(end);
          outputRange.push(dim);
        }
        if (end < 1) {
          inputRange.push(1);
          outputRange.push(dim);
        }
        const color = anim.interpolate({ inputRange, outputRange });
        return (
          <Animated.Text key={i} style={{ color }}>
            {ch}
          </Animated.Text>
        );
      })}
    </Animated.Text>
  );
}

export default PixelSpinner;
