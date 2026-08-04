---
name: apple-hig
description: Apple Human Interface Guidelines(영문 최신판) 규범 요약. 화면 설계·컴포넌트 선택·리뷰 전 필독. "이 상황에 시트를 쓸지 알럿을 쓸지", "권한은 언제 요청할지", "이 컴포넌트를 이렇게 써도 되는지"를 판단할 때 참조하는 결정 규칙서. 치수(포인트 값)는 다루지 않음 — 별도 blueprints 문서 참조.
---

# Apple HIG 규범 요약 (iOS / iPadOS 중심)

이 문서는 developer.apple.com/design/human-interface-guidelines (영문판, 2026-07 기준 최신)를 근거로 정리한 **결정 규칙서**다. 서술형 설명이 아니라 "이 상황엔 이걸 써라 / 쓰지 마라" 형태로 정리했다. 키코 모바일이 iOS/iPadOS 중심 앱이므로 iOS/iPadOS 규칙을 우선하고, macOS/tvOS/watchOS/visionOS는 참고가 필요할 때만 짧게 덧붙였다.

치수(pt 값, 최소 탭 영역 등)는 이 문서의 범위가 아니다 — 별도 blueprints 문서가 담당한다.

---

## 1. 원칙 3줄 요약

Apple이 2026-06-08에 재도입한 최신 프레임(Purpose / Agency / Responsibility / Familiarity / Flexibility / Simplicity / Craft / Delight, 총 8개)을 3줄로 압축하면:

1. **목적과 주도권(Purpose·Agency)** — 제품이 실제로 사람에게 가치를 주는 일에만 집중하고, 사람이 흐름에 갇히지 않고 자유롭게 탐색·실수 복구할 수 있게 하라.
2. **신뢰와 익숙함(Responsibility·Familiarity·Flexibility)** — 권한 요청 이유를 투명하게 밝히고, 데이터는 최소 수집하며, 익숙한 개념과 일관된 시각/상호작용으로 모든 기기·모든 사람에게 동일하게 배려하라.
3. **단순함과 완성도(Simplicity·Craft·Delight)** — 필요한 것만 남기고 위계를 분명히 하며, 세부까지 공들여 만들되 그 정성이 과제 수행을 방해하지 않게 하라.

(과거의 "Clarity / Deference / Depth" 3원칙은 폐기되었고, 위 8원칙이 현재 HIG 전체의 기반 원칙이다.)
<!-- source: https://developer.apple.com/design/human-interface-guidelines/design-principles -->

---

## 2. 패턴 규범 — 언제 무엇을 쓸지

### 2.1 모달(Modality) 사용 기준

- **모달은 "명확한 이득이 있을 때만"** 사용한다. 단순히 화면을 가리는 용도로 쓰지 않는다.
- 모달 작업은 **짧고 단순하게** 유지한다. 모달 안에 또 다른 계층 구조(앱 속의 앱)를 만들지 않는다.
- 모달을 닫는 **명백한 방법**(버튼 또는 스와이프)을 항상 제공한다.
- 닫을 때 **데이터 손실이 발생**할 수 있으면 확인을 받는다.
- **모달은 동시에 하나만** — 이미 열린 모달 위에 새 모달을 얹지 않는다(알럿도 동시에 1개까지).
<!-- source: https://developer.apple.com/design/human-interface-guidelines/modality -->

### 2.2 시트 vs 팝오버 vs 알럿 vs 액션시트 — 결정표

| 상황 | 선택 | 이유 |
|---|---|---|
| 현재 맥락과 밀접한 **범위가 좁은 작업**(정보 입력, 파일 첨부 등)을 완료 후 돌아와야 함 | **Sheet** | 부모 화면과 연결된 임시 작업에 최적. iOS/iPadOS는 nonmodal sheet도 가능(예: 서식 편집 중 부모 뷰 계속 조작) |
| **복잡하거나 여러 단계**의 작업(영상 재생, 사진/문서 편집) | **Full-screen modal** | 시트보다 집중도가 높음. "복잡하거나 장시간 걸리는 흐름엔 시트 대신 풀스크린 모달을 고려하라"가 명시 규칙 |
| 사람이 **이미 시작한 특정 행동에 대한 선택지**(초안 삭제/저장/계속 편집 등)를 줘야 함 | **Action sheet** (SwiftUI confirmationDialog) | 알럿과 달리 "의도적 행동에 따른 선택"을 제공하는 용도. visionOS는 미지원 |
| **중요하고 즉각적인 정보**(문제 발생, 파괴적 행동 경고, 구매 확인)를 전달해야 함, 선택지는 최대 3개 버튼 | **Alert** | 단순 정보 전달용으로 쓰지 않는다 — actionable 하지 않은 정보는 알럿이 아니라 인라인 인디케이터로 |
| 부모 창을 계속 쓰면서 **보조 정보/도구**를 옆에 띄우고 싶음(주로 iPad/Mac) | **Popover / nonmodal sheet** | 부모 컨텍스트를 유지해야 하는 보조 작업에 적합 |

추가 규칙:
- **앱 시작 시 알럿을 띄우지 않는다.** 네트워크 문제 등은 캐시 데이터 + 비강제 인디케이터로 대체.
- **일반적이고 되돌릴 수 있는 파괴적 행동**(메일 삭제 등)에는 알럿을 띄우지 않는다. 드물고 되돌릴 수 없는 파괴적 행동에만 경고.
- 알럿 기본 버튼 타이틀로 "OK"는 **순수 정보성 알럿에만** 쓴다. 그 외엔 "Delete", "Erase" 등 결과를 명시하는 동사.
- Action sheet에서 파괴적 버튼은 **위쪽(가장 눈에 띄는 위치)**, Cancel은 아래쪽.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/sheets ,
     https://developer.apple.com/design/human-interface-guidelines/alerts ,
     https://developer.apple.com/design/human-interface-guidelines/action-sheets ,
     https://developer.apple.com/design/human-interface-guidelines/modality -->

### 2.3 권한 요청 타이밍 (알림 / 데이터 접근)

- **알림 권한은 반드시 사전 동의(permission)가 필요**하다. 요청 시점 원칙:
  - 앱이 **작동하기 위해 필수적인 데이터/자원**이면 → **온보딩 흐름에 통합**해서 이유를 설명하며 요청.
  - 그렇지 않다면 → **해당 기능에 처음 접근하는 순간**에 요청 (선요청 금지).
- **마케팅/프로모션 알림은 별도의 명시적 옵트인**이 필요하다 (필수 기능 권한 요청과 절대 묶지 않는다). 옵트인 UI에서 "어떤 정보를 보낼지"를 설명해야 한다.
- 마케팅 알림에는 **절대 Time Sensitive 인터럽션 레벨을 쓰지 않는다** — Focus/무음 모드를 뚫고 들어가면 안 됨.
- Time Sensitive는 **"지금 일어나고 있거나 1시간 내 일어날 일"**에만 사용. 남용 시 사용자가 신뢰를 잃고 알림을 꺼버린다.
- 앱 내에 **알림 설정을 변경할 수 있는 화면**을 반드시 제공한다(권한 요청과 별개로).
- **레이팅/구매 요청은 온보딩보다 나중에**, 사람이 앱에 충분히 몰입한 뒤에 하라.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/managing-notifications ,
     https://developer.apple.com/design/human-interface-guidelines/onboarding -->

### 2.4 내비게이션 구조 결정

| 상황 | 선택 |
|---|---|
| 앱의 **최상위 섹션 간 이동** (Alarm/Stopwatch/Timer 같은 동급 섹션) | **Tab bar** — 이동 전용, 액션 넣지 말 것. 탭 5개 이하 권장, 항상 화면에 보이게 유지 |
| **현재 뷰의 콘텐츠에 대한 명령/액션/검색** | **Toolbar** — 내비게이션과 액션을 함께 담는 바. iOS의 "navigation bar"는 현재 Toolbar 가이드에 통합됨(2025-06-09 병합) |
| 정보 위계가 깊고 넓은 iPad/Mac 앱 | **Sidebar** (또는 Tab bar ↔ Sidebar 전환형 "convertible tab bar") |
| 검색이 앱의 핵심 기능 | 탭바에 **전용 검색 탭**을 두거나(Photos, Apple TV 방식), 툴바 trailing에 검색 필드 배치 |

추가 규칙:
- 탭바 항목은 **비활성화·숨김 처리하지 않는다.** 콘텐츠가 없으면 이유를 설명하는 빈 상태를 보여준다.
- 오버플로우 탭("More")이 생기는 상황은 **최소화**해야 한다.
- 툴바 오버플로우 메뉴는 **시스템이 자동 생성** — 직접 만들지 않는다.
- 창/윈도우 제목에 **앱 이름을 쓰지 않는다.**
<!-- source: https://developer.apple.com/design/human-interface-guidelines/tab-bars ,
     https://developer.apple.com/design/human-interface-guidelines/toolbars ,
     https://developer.apple.com/design/human-interface-guidelines/searching -->

### 2.5 데이터 입력 (Entering data)

- 시스템에서 얻을 수 있는 정보(설정값, 위치, 캘린더 등)는 **절대 다시 입력받지 않는다.**
- 텍스트 입력보다 **선택지(피커/메뉴)를 우선** 제공한다 — 가능하면 타이핑을 피하게 하라.
- 비밀번호 필드는 **절대 미리 채우지 않는다.** 생체 인증/키체인으로 대체를 유도.
- 입력값은 **입력 즉시(dynamically) 검증**하고 문제를 바로 알린다. 이메일은 다음 필드로 넘어갈 때, 아이디/비번은 넘어가기 전에 검증.
- 필수 입력이 안 채워졌으면 **Next/Continue 버튼을 비활성화**해서 다음 단계를 막는다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/entering-data -->

### 2.6 피드백 (Feedback)

- 피드백의 **강도는 정보의 중요도에 비례**해야 한다 — 상태 정보는 조용히, 데이터 손실 경고는 방해가 되더라도 확실히.
- **색상 하나에만 의존하지 않는다** — 색+텍스트+사운드+햅틱을 함께 써서 접근성을 확보한다.
- 예상치 못하고 되돌릴 수 없는 데이터 손실에만 경고한다. 예상된 손실(파일 삭제 등)은 매번 경고하지 않는다.
- 중요한 액션(결제 등) 성공 시에만 완료 확인을 준다 — 사소한 액션까지 매번 확인시키지 않는다.
- 명령이 실행 불가능하면 **이유를 함께 설명**한다 ("목적지를 지정하지 않아 길안내를 할 수 없습니다" 식).
<!-- source: https://developer.apple.com/design/human-interface-guidelines/feedback -->

### 2.7 검색 (Searching)

- 검색이 중요하면 **앱/화면의 주요 위치**(탭바 전용 탭, 툴바 trailing)에 배치한다.
- 앱 전체를 아우르는 **단일 검색 지점**을 지향하되, 섹션이 뚜렷하면 로컬 검색(현재 뷰 필터링)도 허용된다.
- 현재 검색 범위(scope)를 **placeholder 텍스트/스코프바/타이틀로 명확히** 보여준다.
- 최근 검색어·추천 검색어를 제공해 입력을 줄여준다. 단, **검색 기록은 프라이버시를 고려**해 지우는 방법을 제공한다.
- 커스텀 파일 타입을 다룬다면 Spotlight에 인덱싱될 수 있게 메타데이터를 제공한다(시스템 전역 검색 통합).
<!-- source: https://developer.apple.com/design/human-interface-guidelines/searching -->

### 2.8 온보딩 (Onboarding)

- 온보딩은 **선택적(optional)**이어야 하며, 가능하면 "체험하며 배우는" 인터랙티브 방식을 쓴다.
- 단일 긴 온보딩 플로우보다 **맥락에 맞는 짧은 팁(context-specific tips)**을 분산 배치하는 편이 낫다.
- 튜토리얼을 최초 실행 시 건너뛰게 했다면 **다음 실행부턴 다시 보여주지 않는다** (설정/도움말에서 다시 볼 수 있게만).
- 스플래시 화면은 꼭 필요할 때만, **짧게**. 다운로드 대기로 온보딩을 막지 않는다.
- 필수 권한 요청은 온보딩에 통합 가능하지만, **약관/라이선스 상세는 온보딩에 넣지 않는다**(App Store가 담당).
- 비필수 설정/커스터마이징은 **미룬다** — 합리적 기본값으로 바로 쓸 수 있게.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/onboarding -->

---

## 3. Foundations 핵심 규칙

### 3.1 Layout

- 관련 요소는 **여백/구분선/배경 모양**으로 그룹핑하되, 콘텐츠와 컨트롤은 시각적으로 분명히 구분한다.
- 가장 중요한 정보는 **충분한 공간**을 줘서 바로 보이게 하고, 부차 정보는 다른 뷰로 뺀다.
- 배경/전체화면 아트워크는 **화면 끝까지 채운다** — 컨트롤/내비게이션은 콘텐츠 위에 별도 레이어로 뜬다(Liquid Glass 레이어).
- 세이프 에어리어·마진·레이아웃 가이드를 존중해 **회전/리사이즈/다국어(RTL 포함)에도 깨지지 않게** 설계한다.
- Dynamic Type 확대 시에도 **핵심 요소의 위치·위계는 유지**되어야 한다. 큰 폰트에서 잘림(truncation)은 최소화.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/layout -->

### 3.2 Typography

- iOS/iPadOS **기본 17pt, 최소 11pt** — 이보다 작은 텍스트는 지양. 얇은(Ultralight/Thin/Light) 폰트 웨이트는 가독성 문제로 피한다.
- **시스템 텍스트 스타일(Text Style)**을 우선 사용해 Dynamic Type과 접근성 큰 글씨를 자동 지원받는다.
- 커스텀 폰트를 쓰려면 **Dynamic Type 대응(스케일링)을 직접 구현**해야 한다 — 시스템 폰트처럼 자동으로 되지 않는다.
- 폰트 사이즈가 커져도 **전체 정보 위계는 유지**한다. 모든 텍스트가 똑같이 커질 필요는 없다(탭 타이틀처럼 유지되어야 하는 것도 있음).
- 서체 종류는 **최소화** — 너무 많은 typeface를 섞으면 위계가 흐려진다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/typography -->

### 3.3 Color

- 시맨틱 시스템 컬러(system color)를 쓰고 **하드코딩하지 않는다** — 값은 릴리즈마다 바뀔 수 있다.
- 하나의 색을 **다른 의미로 재사용하지 않는다**(같은 색이 상태 표시와 브랜드 장식을 동시에 의미하면 혼란).
- **색상 하나로만 정보를 구분하지 않는다** — 색맹 등 접근성을 위해 텍스트/아이콘 형태를 병행한다.
- 커스텀 컬러를 정의하면 **라이트/다크/증가된 대비(Increased Contrast) 변형까지 함께** 제공해야 한다.
- Liquid Glass에는 **컬러를 절제해서** 적용한다 — 주요 CTA 등 진짜 강조가 필요한 곳에만, 배경에 컬러를 넣고 심볼/텍스트는 모노크롬 유지가 기본.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/color -->

### 3.4 Materials (Liquid Glass 포함)

- **Liquid Glass**는 탭바/사이드바 같은 "컨트롤·내비게이션 레이어" 전용이다. **콘텐츠 레이어에는 쓰지 않는다** (예외: 버튼처럼 일시적 인터랙션에 반응해 순간적으로 Glass 외형을 띄는 경우).
- 커스텀 컨트롤에 Liquid Glass 효과를 넣더라도 **아주 절제해서**, 정말 중요한 기능 요소에만 적용한다.
- Regular variant(불투명도 높음) vs Clear variant(투명): **텍스트가 많거나 배경이 복잡한 곳은 Regular**, 사진/영상 위에 뜨는 요소는 **Clear**를 쓴다.
- Clear variant를 밝은 배경 위에 쓸 땐 **35% 불투명도의 dimming 레이어**를 고려한다.
- Standard materials(ultra-thin/thin/regular/thick)는 **의미(semantic)에 맞게** 고르지, 그 순간의 색감으로 고르지 않는다 — 시스템 설정에 따라 외형이 바뀔 수 있다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/materials -->

### 3.5 Spatial layout (visionOS 전용 — 참고용)

키코 모바일은 iOS/iPadOS 앱이므로 이 섹션은 **낮은 우선순위**다. visionOS를 지원하게 될 경우에만 참조.

- 중요한 콘텐츠는 사람 **시야(field of view) 중앙**에 위치시키되, 머리에 고정(anchor to head)하지 않는다.
- 깊이(depth)는 **위계 표현용**으로만 절제해서 쓴다 — 텍스트에 깊이를 주면 가독성이 떨어진다.
- 인터랙티브 요소 주변에는 **충분한 여백**을 둬서 시선 인터랙션(hover)이 겹치지 않게 한다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/spatial-layout -->

---

## 4. 컴포넌트별 핵심 규칙

### Lists and tables
- 텍스트 위주 콘텐츠는 **리스트/테이블 우선** — 이미지가 크거나 많으면 Collection을 고려.
- 항목 텍스트는 **짧고 명확하게** — 잘림/줄바꿈을 최소화한다.
- iOS/iPadOS: **info 버튼(디테일 디스클로저)은 정보 보기 전용**이며 계층 내비게이션 용도가 아니다 — 드릴다운엔 disclosure indicator를 쓴다.
- 인덱스(알파벳 인덱스)와 trailing 컨트롤(디스클로저 등)을 **동시에 두지 않는다** — 오조작 유발.
- 선택 피드백은 맥락에 맞게: 계층 내비게이션이면 **선택 행 강조 유지**, 옵션 목록이면 **체크마크로 짧게 표시**.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables -->

### Buttons
- 버튼 하나는 **Style(시각 스타일) + Content(심볼/텍스트) + Role(의미)** 3요소로 구성된다.
- 화면당 **prominent(강조) 버튼은 1~2개**로 제한한다 — 너무 많으면 인지 부하 증가.
- Role은 Normal/Primary/Cancel/Destructive 4종. **파괴적 액션에 Primary role을 주지 않는다** (사람들이 확인 없이 누를 위험).
- 커스텀 버튼에는 반드시 **눌림 상태(press state)**를 넣는다 — 없으면 반응이 없는 것처럼 느껴진다.
- 아이콘만 쓸 땐 **익숙한 액션-아이콘 매핑**(예: 공유 = square.and.arrow.up)을 따른다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/buttons -->

### Sheets
- 부모 화면과 **밀접한 범위 좁은 작업**에 사용한다. 복잡하거나 다단계 작업은 풀스크린 모달을 고려.
- **한 번에 시트 하나만** — 시트 위에 새 시트를 띄우지 않는다(먼저 닫고 새로 연다).
- Cancel/Close, Done, Back 버튼을 상황에 맞게 배치하되, **셋을 동시에 다 보여주지 않는다.**
- iOS는 medium/large detent를 지원 — **점진적 정보 공개(progressive disclosure)**가 유용하면 medium detent를 활용.
- 저장 안 된 변경사항이 있는데 스와이프로 닫으려 하면 **확인용 액션시트**를 띄운다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/sheets -->

### Alerts
- **아껴서 사용** — 정보성(actionable 하지 않은) 내용에는 알럿을 쓰지 않는다.
- 타이틀은 **무슨 일이 일어났는지 구체적으로** 서술한다("Error" 같은 무의미한 타이틀 금지).
- 버튼 타이틀은 **1~2단어, 결과를 설명하는 동사**로("Erase", "Reply") — 순수 정보 알럿 외엔 "OK" 지양.
- Destructive 버튼은 **사람이 의도치 않은 파괴적 결과일 때만** destructive 스타일을 적용한다(의도적으로 선택한 행동이면 강조하지 않음).
- Cancel 버튼은 **기본(default) 버튼으로 만들지 않는다** — 무심코 Return 눌러 취소되는 걸 방지.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/alerts -->

### Action sheets
- **이미 시작한 행동에 대한 선택지**를 줄 때만 쓴다(알럿=예상 밖 정보, 액션시트=의도한 행동의 후속 선택).
- 타이틀은 **한 줄에 들어갈 만큼 짧게**, 메시지는 꼭 필요할 때만 추가.
- 파괴적 선택지는 **위쪽에 destructive 스타일**로, Cancel은 아래(watchOS는 좌상단).
- iOS/iPadOS: **스크롤되게 만들지 않는다** — 버튼 수를 줄여서 한 화면에 다 보이게.
- **visionOS는 미지원** — 대체 패턴 필요.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/action-sheets -->

### Tab bars
- **내비게이션 전용** — 액션(공유, 삭제 등)을 탭바에 넣지 않는다.
- 이동 중에도 **탭바는 항상 보이게** 유지한다(모달이 덮는 경우만 예외).
- 탭 개수는 **필요한 만큼만** — 너무 많으면 iOS/iPadOS에서 "More" 오버플로우 탭이 생겨 발견성이 떨어진다.
- 탭바 버튼은 **콘텐츠가 없어도 비활성화/숨김 처리하지 않는다.**
- 뱃지(빨간 원)는 **정말 중요한 정보에만** 예약해서 의미를 희석시키지 않는다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/tab-bars -->

### Toolbars (Navigation bars 가이드가 여기 통합됨, 2025-06-09부)
- Toolbar = **타이틀 + 내비게이션 컨트롤(Back 등) + 액션(bar item)** 3요소.
- 항목이 넘치면 **시스템이 자동으로 overflow 메뉴를 만든다** — 직접 만들지 않는다.
- **Prominent 스타일은 핵심 액션(Done/Submit) 하나에만**, trailing 쪽에 배치.
- 텍스트 라벨 버튼끼리는 **붙여놓지 않는다** — 하나의 액션처럼 오인될 수 있어 간격을 준다.
- 그룹은 **최대 3개 이내**로 최소화한다 — 그룹이 많으면 산만해진다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/toolbars -->

### Text fields
- 짧은 정보(이름, 이메일)에만 사용 — 긴 텍스트는 **Text view**를 쓴다.
- Placeholder 텍스트 + 별도 레이블을 함께 써서 **입력 후에도 필드 의미가 남게** 한다.
- 민감 정보는 **Secure text field**를 쓰고, **비밀번호 필드는 절대 프리필하지 않는다.**
- 입력 종류에 맞는 **키보드 타입**을 지정한다(숫자, URL 등) — 데이터 입력 속도를 높인다.
- iOS/iPadOS: trailing에 **Clear 버튼**을 제공해 지우기를 쉽게 한다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/text-fields -->

### Segmented controls
- **밀접하게 연관된 선택지**(하나의 대상/상태/뷰에 영향)에만 사용한다.
- 세그먼트 개수는 **iPhone 5개 이하, 넓은 화면도 5~7개 이내**로 제한한다.
- 한 컨트롤 안에서 **텍스트와 이미지를 섞지 않는다** — 어느 한쪽으로 통일.
- **선택 상태용 컨트롤과 액션 실행용 컨트롤을 섞지 않는다**(하나의 세그먼트 컨트롤 안에서 의미를 통일).
- iOS/iPadOS: 완전히 다른 앱 섹션 전환에는 세그먼트 대신 **Tab bar**를 쓴다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/segmented-controls -->

### Scroll views
- 기본 스크롤 제스처/단축키를 지원하고, **커스텀 스크롤도 elastic(바운스) 동작을 유지**한다.
- **같은 방향의 스크롤뷰를 중첩하지 않는다**(가로 안에 세로는 가능, 같은 방향끼리는 예측 불가한 UX 유발).
- 콘텐츠가 스크롤 가능하다는 걸 **잘리는 콘텐츠 일부를 보여줘서** 암시한다.
- Scroll edge effect는 **떠 있는 바(툴바 등) 뒤에 스크롤뷰가 있을 때만** 적용한다 — 장식용이 아니라 가독성 확보용.
- 페이지 단위 스크롤이 맥락에 맞으면 **Page control**을 함께 고려하되, 같은 축에 스크롤 인디케이터를 중복 표시하지 않는다.
<!-- source: https://developer.apple.com/design/human-interface-guidelines/scroll-views -->

---

## 5. 안티패턴 목록 (HIG가 명시적으로 금지하는 것들)

- **Liquid Glass를 콘텐츠 레이어에 사용** — 컨트롤/내비게이션 레이어 전용이다.
- **시스템 컬러 값을 하드코딩** — API로 참조해야 함(릴리즈마다 값이 바뀔 수 있음).
- **색상 하나로만 상태/의미를 전달** — 색맹 등 접근성 문제.
- **동일한 색을 서로 다른 의미로 재사용** (예: 브랜드 색 = 인터랙티브 표시 + 단순 장식 텍스트).
- **비밀번호 필드 프리필.**
- **앱 시작 시 알럿 표시.**
- **정보 전달만을 위한(비-actionable) 알럿.**
- **일반적이고 되돌릴 수 있는 삭제 행동에 매번 경고 알럿.**
- **알럿의 기본 버튼을 "OK"로(순수 정보성이 아닌 경우) 또는 Cancel 버튼을 default로.**
- **파괴적 액션 버튼에 Primary role 부여.**
- **한 화면에 Prominent 버튼 2개 초과.**
- **동시에 여러 모달·여러 알럿을 띄우기.**
- **모달 안에 또 다른 계층 내비게이션(앱 속의 앱) 만들기.**
- **탭바를 액션 버튼 용도로 사용, 또는 탭바 버튼을 상황에 따라 비활성화/숨김.**
- **너무 많은 탭으로 "More" 오버플로우를 상시 유발.**
- **툴바 오버플로우 메뉴를 수동으로 직접 구현** — 시스템 자동 생성 기능과 충돌.
- **창/윈도우 제목에 앱 이름 사용.**
- **텍스트 라벨 버튼들을 간격 없이 붙여 배치**(하나의 버튼처럼 오인).
- **세그먼트 컨트롤 안에서 텍스트/이미지 혼용, 또는 선택상태·액션실행 의미 혼용.**
- **같은 방향의 스크롤뷰 중첩.**
- **마케팅 알림에 Time Sensitive 인터럽션 레벨 사용, 또는 별도 옵트인 없이 마케팅 알림 발송.**
- **온보딩에 약관/라이선스 상세, 대용량 다운로드 대기를 끼워 넣기.**
- **visionOS에서 Action sheet 사용**(미지원 컴포넌트).
- **macOS에서 창 하단에 중요 컨트롤/정보 배치** (창을 아래로 내려서 화면 밖으로 나가는 경우가 흔함).

---

## 부록: 출처 페이지 목록

**Foundations**
- Layout — https://developer.apple.com/design/human-interface-guidelines/layout
- Typography — https://developer.apple.com/design/human-interface-guidelines/typography
- Color — https://developer.apple.com/design/human-interface-guidelines/color
- Materials — https://developer.apple.com/design/human-interface-guidelines/materials
- Spatial layout — https://developer.apple.com/design/human-interface-guidelines/spatial-layout (visionOS 전용)

**Patterns**
- Modality — https://developer.apple.com/design/human-interface-guidelines/modality
- Feedback — https://developer.apple.com/design/human-interface-guidelines/feedback
- Entering data — https://developer.apple.com/design/human-interface-guidelines/entering-data
- Managing notifications — https://developer.apple.com/design/human-interface-guidelines/managing-notifications
- Onboarding — https://developer.apple.com/design/human-interface-guidelines/onboarding
- Searching — https://developer.apple.com/design/human-interface-guidelines/searching

**Components**
- Lists and tables — https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- Buttons — https://developer.apple.com/design/human-interface-guidelines/buttons
- Sheets — https://developer.apple.com/design/human-interface-guidelines/sheets
- Alerts — https://developer.apple.com/design/human-interface-guidelines/alerts
- Action sheets — https://developer.apple.com/design/human-interface-guidelines/action-sheets
- Tab bars — https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Toolbars (Navigation bars 통합됨) — https://developer.apple.com/design/human-interface-guidelines/toolbars
- Text fields — https://developer.apple.com/design/human-interface-guidelines/text-fields
- Segmented controls — https://developer.apple.com/design/human-interface-guidelines/segmented-controls
- Scroll views — https://developer.apple.com/design/human-interface-guidelines/scroll-views

**추가로 참고한 페이지**
- Design principles — https://developer.apple.com/design/human-interface-guidelines/design-principles

**리다이렉트 확인됨 (404 아님, URL만 변경됨)**
- `/design/human-interface-guidelines/navigation-bars` → 301 redirect → `/design/human-interface-guidelines/toolbars` (2025-06-09 가이드 통합)

**실패한 URL**: 없음. 위 21개 페이지 모두 정상 수집됨. (단, 브라우저 렌더링 방식의 WebFetch 직접 호출은 이 사이트가 JS SPA라 본문을 못 가져왔고, 대신 DocC 렌더러가 쓰는 JSON 데이터 엔드포인트 `https://developer.apple.com/tutorials/data/design/human-interface-guidelines/<slug>.json`를 찾아 원문 텍스트를 추출했다.)
