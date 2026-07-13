# 디자인 시스템 통합/마이그레이션 초안

**목적**: PR #36 로 도입된 새 파운데이션(`src/theme/*`)과 기존 팀 파운데이션(`src/constants/*` + 컴포넌트 하드코딩 값)을 어떻게 정리·통합할지 방향을 정하고 실행 단위를 나눈다.

**결정이 필요한 것**: 아래 [정리 방향 옵션](#정리-방향-4가지) 중 어디까지 갈지 + 실행 순서.

---

## 1. 배경

- PR #36 이 애플 HIG 기반 디자인 파운데이션을 도입 (`src/theme/*` + `docs/design-system.md` + `CLAUDE.md` 규약).
- 새 규약 두 줄:
  1. **Never hardcode design values** — 색/라디우스/그림자/스프링/오파시티 등은 전부 `@/theme` 에서.
  2. **Import from `@/theme`** — `@/constants/*` 나 raw 라이브러리 직접 참조 금지.
- 그런데 기존 파운데이션 (`src/constants/ios.ts`, `src/constants/theme.ts`) 은 그대로 살아있고, 소비 코드도 아직 옛 경로에서 import 중.
- 값 자체는 `src/theme/index.ts` 가 기존 상수를 re-export 하는 형태로 이미 한 지붕에 들어와 있음. **문제는 아직 아무도 그렇게 쓰지 않고 있다는 것.**

---

## 2. 현재 상태 스냅샷

### 2.1 새 파운데이션 (`src/theme/*`)

| 파일 | 다루는 것 |
|---|---|
| `motion.ts` | 스프링 6종 (`Motion.move / rotation / drawer / snappy / gentle / bouncy`) + `Duration` + `Easing` |
| `radius.ts` | `Radius` 스케일 + `RadiusRole` (chip / button / field / image / card / sheet) |
| `elevation.ts` | 그림자 5종 (`flat / raised / lifted / floating / overlay`) |
| `opacity.ts` | `Opacity` + `Scrim` (overlay 계열) |
| `brand.ts` | `BrandColors.peach.*` + `BrandRole` + `BrandGradient.loginMarquee` |
| `glass.ts` | 리퀴드 글래스 프리셋 4종 (`Glass.chip / composer / bareOnColor / clear`) |
| `index.ts` | 위 6개 + 기존 `@/constants/ios`, `@/constants/theme` 전체 re-export |

### 2.2 기존 파운데이션 (`src/constants/*`)

| 파일 | 내용 | 새 theme 와의 관계 |
|---|---|---|
| `ios.ts` | `IOSColors`, `IOSFont`, `IOSText`, `Haptic` | ✅ `@/theme` 에서 re-export |
| `theme.ts` | `Colors` (light/dark), `Fonts`, `Spacing`, `BottomTabInset`, `MaxContentWidth` | ✅ `@/theme` 에서 re-export |
| `splashImages.ts` | 스플래시 에셋 | 디자인 토큰 아님, 그대로 둠 |

### 2.3 소비 현황
- 25+ 파일 (`src/app/*`, `src/components/*`) 이 여전히 `@/constants/*` / raw `rgba(...)` / raw `withSpring({...})` 등을 직접 사용 중.

---

## 3. 정리해야 할 갭

### 3.1 Import 경로 미마이그레이션
새 규약은 "Import from `@/theme`" 인데 25+ 파일이 아직 `@/constants/*` 또는 raw 라이브러리 참조. **가장 큰 볼륨.**

### 3.2 하드코딩값 마이그레이션
새 규약 "Never hardcode design values" 어긴 지점들:

- `borderRadius: 12` / `borderRadius: 20` 등 → `RadiusRole.*`
- `shadowColor: '#000', shadowOffset: {...}` 세트 → `Elevation.*`
- `withSpring({ damping: 15, stiffness: 200 })` → `Motion.*`
- `opacity: 0.5` 등 → `Opacity.*`
- `rgba(255,255,255,0.85)` 같은 하드 알파 → `IOSColors + Opacity` 조합
- `product-card.tsx` 의 `CARD_WIDTH = 156` 같은 컴포넌트 로컬 상수 → 유지할지 theme 로 승격할지 판단 필요

### 3.3 `Colors` (light/dark) 이중 관리
`theme.ts` 의 `Colors.light/dark` 는 명시적 라이트/다크 세트. `IOSColors` 는 `PlatformColor` 로 OS 가 알아서 다크 처리. **역할이 겹침.** 새 규약은 IOSColors 우선 → `Colors` 는 deprecate 또는 매핑 통합 대상.

### 3.4 `IOSFont` vs `Fonts` 중복
`ios.ts` 의 `IOSFont` 와 `theme.ts` 의 `Fonts` 가 거의 동일. 하나로 통일 필요. (`Fonts` 는 web fallback 있음, mobile 전용이라 `IOSFont` 로 통일 가능)

### 3.5 `GlassSurface` 컴포넌트와 `Glass` 토큰 연결
새 `glass.ts` 는 "GlassSurface 에 이 프리셋을 spread 하라" 는 컨트랙트인데, 실제 `GlassSurface` API 가 `glassStyle` / `variant` / `bordered` prop 을 받는지 검증 필요. 안 받으면 컴포넌트 시그니처부터 맞춰야 함.

---

## 4. 정리 방향 4가지

| 옵션 | 스코프 | 부담 | 리스크 | 규약 준수도 |
|---|---|---|---|---|
| **A. 최소** | 신규 코드부터만 `@/theme` 사용, 기존은 그대로 | 매우 낮음 | 규약이 유명무실화 (계속 옛 경로 씀) | 낮음 |
| **B. import 경로만** | 기존 25+ 파일에서 `@/constants/*` → `@/theme` 로 import 만 변경 (값 변경 없음) | 낮음, 기계적 | 없음. 리뷰 diff 만 큼 | 중간 |
| **C. B + Colors/Fonts 중복 제거** | + `theme.ts` 의 `Colors`/`Fonts` deprecate 또는 IOSColors 로 매핑 통합 | 중간 | 다크모드 소비 지점 재검토 필요 | 높음 |
| **D. C + 하드코딩값 전면 마이그** | + repo 전체의 하드 radius / shadow / spring / opacity / rgba 를 theme 토큰으로 교체 | 큼 | 시각 리그레션 (수치 미세 차이) | 완전 |

### 추천: **B → C → D 순으로 PR 3개**

- **B**: 리스크 zero + 규약이 실제로 지켜지기 시작. 첫 관문.
- **C**: 이중 관리 정리. 한 번은 해야 함. 소비 지점 회귀 테스트 필요.
- **D**: diff 크고 리그레션 리스크. 시각 확인 여유 두고 마지막에. 파일 그룹 단위 (`src/app/*` vs `src/components/*`) 로 쪼개는 것도 옵션.

---

## 5. 실행 순서 제안

### Phase 0 — 준비 (선행 필수)
- `GlassSurface` 컴포넌트 시그니처 확인. `Glass.*` 프리셋을 spread 로 받는 구조인지 검증. 아니면 컴포넌트 API 조정.
- 기존 `Colors.light/dark` 의 실제 소비 지점 grep — 다크 모드 대응이 지금 어떻게 되어 있는지 파악해야 IOSColors 로 통합 시 리그레션 방지 가능.

### Phase 1 (PR #1) — Import 경로 마이그레이션
- `src/**/*.{ts,tsx}` 에서 `@/constants/ios` / `@/constants/theme` import 를 `@/theme` 로 일괄 변경.
- 값 변경 없음. 시각 리그레션 zero.
- 리뷰는 diff 크기만 크지 사실상 rubber-stamp.

### Phase 2 (PR #2) — 중복/이중 관리 정리
- `Fonts` → `IOSFont` 로 통일 (또는 반대).
- `Colors.light/dark` 소비 지점을 `IOSColors` 로 마이그. `Colors` 는 필요 시 shim 으로만 잠깐 남기고 후속 삭제.
- 소비 지점별 다크모드 육안 확인.

### Phase 3 (PR #3~N) — 하드코딩값 마이그
- 파일 그룹별로 쪼개서 진행. 예:
  - PR #3: `src/components/*` 의 radius / shadow / opacity
  - PR #4: `src/app/*` 의 radius / shadow / opacity
  - PR #5: repo 전체의 spring / timing
  - PR #6: repo 전체의 raw `rgba(...)`
- 각 PR 마다 스크린샷 비교 (before / after) 리뷰 첨부.

---

## 6. 결정 필요 사항

1. **어디까지 갈 것인가** — A / B / C / D 중 목표점.
2. **누가 어느 Phase 를 담당하나** — 특히 Phase 3 는 시각 리그레션 리스크가 있어 프론트 리뷰어 붙어야 함.
3. **`Colors.light/dark` 다크모드 정책** — IOSColors 로 통합해도 지금 다크모드가 정상 동작하는지 (혹은 아직 다크모드 지원 안 하는지) 확인 필요. 이거에 따라 Phase 2 난이도가 달라짐.
4. **컴포넌트 로컬 상수 처리** — `CARD_WIDTH = 156` 같은 값. theme 로 승격 vs 컴포넌트 내부 상수 유지 — 기준 필요.
5. **`splashImages.ts` 등 비-토큰 상수** — `constants/` 폴더 자체를 남길지, `assets/` 등으로 이동할지.

---

## 6.5 진행 결과 (2026-07-13)

| Phase | 상태 | 비고 |
|---|---|---|
| Phase 1 — import 경로 마이그 (`@/constants/*` → `@/theme`) | ✅ 머지 | 23 파일, 값 변경 zero |
| Phase 2 — `Colors` / `Fonts` / `useTheme` / `use-color-scheme` dead code 제거 | ✅ 머지 | Phase 0 grep 으로 소비 zero 확인 후 shim 없이 삭제. 5 파일, -106 순감 |
| Phase 3-a — `src/components/*` 하드값 마이그 (리허설) | ✅ 머지 | 4 파일, Radius/Elevation/Opacity 매핑 정책 확립 |
| Phase 3-b — `src/app/*` opacity 마이그 | ✅ 머지 | 6 파일, 13 지점 |
| Phase 3-c — `src/app/*` borderRadius 마이그 | ✅ 머지 | 15 파일, 78 지점. 사이드바 drawer + 유저 이미지 원형 오매핑 후속 원복 포함 |
| Phase 3-d — `withAlpha` 헬퍼 도입 + `rgba` 리터럴 마이그 | ✅ 머지 | 10 파일, 23 지점 |
| Phase 3-e — motion (`withTiming` / `Animated.timing`) | ⏭️ 스킵 | 아래 정책 참조 |

### Phase 3-e 스킵 근거 + motion 정책

실사 결과:
- Reanimated `withTiming` 소비 = **1건** (`app/index.tsx` splash)
- react-native `Animated.timing` 소비 = 9건, 전부 컴포넌트 로컬 상수(`FADE_MS`, `OPEN_MS`, `CLOSE_MS` 등)로 이미 semantic 이름 부여됨
- `Motion.*` / `Duration.*` 토큰 소비 = **0**

**정책**
- **로컬 튜닝된 애니메이션 상수는 `Motion` / `Duration` 스케일로 승격하지 않는다.** splash / drawer / banner fade 등은 각각 화면 특수 튜닝이 필요하고, 스케일 강제는 튜닝 자유도만 훼손함 (Rule of Three 미달 + 시각적 통일 이득 없음).
- **`Motion` / `Duration` / `Easing` 토큰은 신규 UI 작업 시 스프링·타이밍 선택의 기본값으로 사용.** 로컬 튜닝이 필요할 때만 상수로 뽑는다.
- 예외: 스케일과 정확 매치되는 특수 상수 (예: `RISE_MS = 500` = `Duration.slow`) 도 억지 마이그 대신 로컬 유지 — 튜닝 시 값을 살짝 조정할 수도 있는 semantic 이 강함.

---

## 7. 부록 — 이미 통합돼 있는 것 (참고)

`src/theme/index.ts` 에서 기존 상수를 아래처럼 re-export 함:

```ts
export { IOSColors, IOSFont, IOSText, Haptic } from '@/constants/ios';
export { Colors, Fonts, Spacing, BottomTabInset, MaxContentWidth } from '@/constants/theme';
```

따라서 신규 코드는 이미 `import { IOSColors, Spacing, Motion, RadiusRole } from '@/theme'` 한 줄로 다 가져올 수 있음. Phase 1 은 이 사실을 소비 코드에도 반영하는 것뿐.
