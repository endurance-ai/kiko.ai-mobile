# Border Beam — 활용 가이드 (RN 이식 레시피)

레퍼런스: https://beam.jakubantalik.com/ — 요소 테두리를 따라 빛줄기(beam)가 흐르는 애니메이션 보더. 웹(React + CSS) 컴포넌트라 그대로는 못 쓰고, 이 문서는 **Kiko AI 모바일에서 언제·어디에·어떻게** 쓸지 정리한 것.

## 언제 쓰나 (natural-language → 사용처 매핑)

| 이런 요청이 오면 | Border Beam 후보 |
|---|---|
| "이 카드 강조해줘", "프리미엄 느낌으로 하이라이트" | 큐레이션 카드 중 에디터 픽 1개 |
| "검색 중인 거 보여줘", "AI가 일하는 중" | 컴포저 테두리 (검색/분석 진행 중 상태) |
| "결제 유도 버튼 눈에 띄게" | 구독 CTA 카드 |
| "새로 들어온 브랜드 표시" | 신규 브랜드 뱃지/카드 |

**절제 원칙 (apple-design 스킬)**: 한 화면에 beam은 **동시에 1개만**. 상시 노출이 아니라 상태(진행 중)나 위계(단 하나의 추천)를 전달할 때만. 장식으로 도배하면 효과가 죽는다.

## RN 이식 레시피 (구현 시 참고)

웹 원본은 CSS `conic-gradient` + `offset-path` 회전. RN에는 둘 다 없으므로 아래 조합으로 재현한다. 필요한 dep는 모두 이미 설치돼 있음:

- `@react-native-masked-view/masked-view` (RNCMaskedView — 설치됨)
- `expo-linear-gradient` (설치됨)
- `react-native-reanimated` 4 (설치됨)

**구조**:

```
<View>                        ← 대상 카드 (borderRadius = RadiusRole.card)
  <MaskedView                 ← 절대 위치로 카드 위에 겹침, pointerEvents="none"
    maskElement={보더 링}      ← 두께 2px 의 라운드 사각 링 (배경 투명, 테두리만 불투명)
  >
    <Animated.View            ← withRepeat(withTiming(rotate 360°)) 회전
      style={{ width/height: 카드 대각선 이상 }}
    >
      <LinearGradient         ← 빔 그라디언트: transparent → BrandRole.primary → transparent
        colors={['transparent', BrandRole.primary, 'transparent']}
        start/end 대각선
      />
    </Animated.View>
  </MaskedView>
  {children}
</View>
```

- 마스크가 "테두리 링"만 통과시키고, 그 뒤에서 그라디언트 판이 회전 → 빛줄기가 테두리를 따라 도는 것처럼 보임.
- 회전 속도: 1회전 4~6초 (`withRepeat(withTiming(360, { duration: 5000, easing: linear }), -1)`), 진행 중 상태 표현이면 2~3초로 빠르게.
- 빔 색: `BrandRole.primary`(peach) 기본. 진행 중 상태면 `IOSColors.systemBlue` 고려.
- reduced-motion: `useReducedMotion()` (reanimated) true면 회전 정지하고 은은한 고정 보더로 대체.

**성능 주의**: 회전은 transform 이라 UI 스레드에서 돎(reanimated) — 리스트 셀 다수에 동시 적용 금지 (절제 원칙과 동일 결론).

## 토큰 연결

구현하게 되면 `src/theme/motion.ts`에 다음을 추가하고 이 표를 design-system.md에 등록할 것:

```ts
/** Border beam 1회전 시간(ms) — 장식용 5000 / 진행중 상태 2500 */
export const BeamDuration = { ambient: 5000, active: 2500 } as const;
```

## 상태

- [ ] 컴포넌트 미구현 — 필요해지는 첫 사용처가 생길 때 `src/components/border-beam.tsx`로 구현
- 우선순위 후보 1번: 컴포저 "찾는 중" 상태 (§3.2 스피너 보완/대체)
