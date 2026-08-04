# Apple iOS 27 컴포넌트 실측표 (자동 추출)

출처: Apple iOS 27 UI Kit 공식 .sketch (Sketch 2026.2) — Light 변형 기준, 단위 pt.
이 표가 화면 코딩·감사의 1차 기준. 규범(언제 무엇을 쓰는지)은 `.claude/skills/apple-hig`,
디자인 값(색·타이포·글래스)은 iOS 27 tokens.json → `@/theme` 참조.
재생성: scratchpad/extract-blueprints.py (소스 .sketch 는 라이선스상 레포에 커밋하지 않음).

## 핵심 수치 요약 (자주 쓰는 것)

| 항목 | 실측 | 비고 |
|---|---|---|
| 리스트 행 높이 | **52** | 44는 최소 터치 타깃이지 행 높이가 아님 |
| 그룹 테이블 폭 | 370 | 화면 402 − 좌우 인셋 16 |
| 섹션 헤더 / 푸터 | 42~48 / 30~32 | Nested 42 · Prominent 45 · Extra 48 |
| 버튼 Large / Medium / Small | **50** / 34 / 28 | 텍스트 17pt (Small 15pt) |
| 내비 바(Top 툴바) 표준 / 라지 타이틀 | 54 / 105 | 시트용은 70 / 121 |
| 하단 툴바 | 48 (구형 44) | 심볼 버튼 36×36, 캡슐 r19 |
| 시트 닫기 버튼 | 34×34 | SF Pro Medium 20 |
| 디스클로저(›) | SF Pro Semibold 17 | 행 우측 액세서리 |
| 리스트 이미지 라디우스 | 10 | 행 leading 썸네일 |

## Lists
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Lists/Headers/Extra Prominent/Trailing/Button | 44×44 | SFPro-Regular 17 | — |
| Lists/Headers/Extra Prominent/Trailing/Detail + Disclsoure | 60×22 | SFPro-Regular 17, SFPro-Semibold 19 | — |
| Lists/Headers/Extra Prominent/Trailing/Image | 42×42 | — | 10 |
| Lists/Headers/Extra Prominent/Trailing/Action | 44×20 | SFPro-Regular 15 | — |
| Lists/Grouped Table View | 370×520 | — | — |
| Lists/Footer/Footer | 370×30 | SFPro-Regular 13 | — |
| Lists/Header/Extra Prominent | 370×48 | — | — |
| Lists/Header/Nested | 370×42 | — | — |
| Lists/Header/Prominent | 370×45 | — | — |
| Lists/Headers/Extra Prominent/Leading/Title + Subtitle + I | 128×51 | SFPro-Bold 22, SFPro-Regular 15 | 10 |
| Lists/Headers/Extra Prominent/Leading/Title + Supertitle + | 76×70 | SFPro-Bold 22, SFPro-Regular 15 | — |
| Lists/Headers/Extra Prominent/Leading/Title + Supertitle | 76×48 | SFPro-Bold 22, SFPro-Regular 15 | — |
| Lists/Headers/Extra Prominent/Leading/Title + Subtitle | 76×50 | SFPro-Bold 22, SFPro-Regular 15 | — |
| Lists/Headers/Extra Prominent/Leading/Title | 76×28 | SFPro-Bold 22 | — |
| Lists/Headers/Extra Prominent/Leading/Title + Supertitle + | 128×48 | SFPro-Bold 22, SFPro-Regular 15 | 10 |
| Lists/Headers/Prominent/Leading/Title + Subtitle + Image | 120×48 | SFPro-Regular 15, SFPro-Semibold 20 | 10 |
| Lists/Headers/Prominent/Leading/Title + Supertitle + Subti | 68×67 | SFPro-Regular 15, SFPro-Semibold 20 | — |
| Lists/Headers/Prominent/Leading/Title + Supertitle | 68×45 | SFPro-Regular 15, SFPro-Semibold 20 | — |
| Lists/Headers/Nested/Title + Subtitle | 59×42 | SFPro-Regular 15, SFPro-Semibold 17 | — |
| Lists/Headers/Prominent/Leading/Title + Subtitle | 68×47 | SFPro-Regular 15, SFPro-Semibold 20 | — |
| Lists/Headers/Nested/Title | 59×22 | SFPro-Semibold 17 | — |
| Lists/Headers/Prominent/Leading/Title | 68×25 | SFPro-Semibold 20 | — |
| Lists/Headers/Prominent/Leading/Title + Supertitle + Image | 120×45 | SFPro-Regular 15, SFPro-Semibold 20 | 10 |
| Lists/Slide Action/Symbol | 60×44 | SFPro-Regular 18 | — |
| Lists/Slide Action/Symbol and Label | 84×44 | SFPro-Regular 13, SFPro-Regular 16 | — |
| Lists/Slide Action/Symbol and Label Stacked | 60×68 | SFPro-Regular 13, SFPro-Regular 18 | — |
| Lists/Rows/Leading/Placeholder | 52×52 | — | — |
| Lists/Rows/Editing/Editing Selected | 25×52 | SFPro-Medium 17 | — |
| Lists/Rows/Editing/Editing Unselected | 25×52 | — | — |
| Lists/Rows/Editing/Insert | 25×52 | SFPro-Medium 17 | — |
| Lists/Rows/Editing/Delete | 25×52 | SFPro-Medium 17 | — |
| Lists/Rows/Accessories - Trailing/Disclosure - Expanded | 8×52 | SFPro-Semibold 17 | — |
| Lists/Rows/Accessories - Trailing/Disclosure - Collapsed | 8×52 | SFPro-Semibold 17 | — |
| Lists/Section Index | 14×270 | SFPro-Semibold 11 | — |
| Lists/Section Index/Section Index - iPhone | 16×667 | — | — |
| Lists/Rows/Accessories - Trailing/Date and Time Picker | 214×52 | — | — |
| Lists/Rows/Accessories - Trailing/Stepper | 92×52 | — | — |
| Lists/Rows/Accessories - Trailing/Toggle | 64×52 | — | — |
| Lists/Rows/Accessories - Trailing/Pop-up Button | 188×52 | SFPro-Regular 17 | — |
| Lists/Rows/Accessories - Trailing/Symbol | 160×52 | SFPro-Regular 17, SFPro-Semibold 17 | — |

## Buttons
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Buttons/Large/Bordered/Symbol/4 - Disabled | 50×50 | SFPro-Regular 17 | — |
| Buttons/Large/Bordered/Symbol/1 - Idle | 50×50 | SFPro-Regular 17 | — |
| Buttons/Large/Bordered/Text/4 - Disabled | 72×50 | SFPro-Regular 17 | — |
| Buttons/Large/Bordered/Symbol + Text/4 - Disabled | 91×50 | SFPro-Regular 17 | — |
| Buttons/Large/Bordered/Symbol + Text/1 - Idle | 91×50 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered/Symbol/4 - Disabled | 34×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered/Symbol/1 - Idle | 34×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered/Text/4 - Disabled | 56×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered/Symbol + Text/4 - Disabled | 75×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered/Symbol + Text/1 - Idle | 75×34 | SFPro-Regular 17 | — |
| Buttons/Small/Bordered/Symbol/4 - Disabled | 28×28 | SFPro-Regular 15 | — |
| Buttons/Small/Bordered/Symbol/1 - Idle | 28×28 | SFPro-Regular 15 | — |
| Buttons/Small/Bordered/Text/4 - Disabled | 49×28 | SFPro-Regular 15 | — |
| Buttons/Small/Bordered/Symbol + Text/4 - Disabled | 66×28 | SFPro-Regular 15 | — |
| Buttons/Small/Bordered/Symbol + Text/1 - Idle | 66×28 | SFPro-Regular 15 | — |
| Buttons/Large/Bordered Prominent/Symbol/4 - Disabled | 50×50 | SFPro-Regular 17 | — |
| Buttons/Large/Bordered Prominent/Symbol/1 - Idle | 50×50 | SFPro-Regular 17 | — |
| Buttons/Large/Bordered Prominent/Text/4 - Disabled | 72×50 | SFPro-Regular 17 | — |
| Buttons/Large/Bordered Prominent/Symbol + Text/4 - Disable | 91×50 | SFPro-Regular 17 | — |
| Buttons/Large/Bordered Prominent/Symbol + Text/1 - Idle | 91×50 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered Prominent/Symbol/4 - Disabled | 34×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered Prominent/Symbol/1 - Idle | 34×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered Prominent/Text/4 - Disabled | 56×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered Prominent/Symbol + Text/4 - Disabl | 75×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Bordered Prominent/Symbol + Text/1 - Idle | 75×34 | SFPro-Regular 17 | — |
| Buttons/Small/Bordered Prominent/Symbol/4 - Disabled | 28×28 | SFPro-Regular 15 | — |
| Buttons/Small/Bordered Prominent/Symbol/1 - Idle | 28×28 | SFPro-Regular 15 | — |
| Buttons/Small/Bordered Prominent/Text/4 - Disabled | 49×28 | SFPro-Regular 15 | — |
| Buttons/Small/Bordered Prominent/Symbol + Text/4 - Disable | 66×28 | SFPro-Regular 15 | — |
| Buttons/Small/Bordered Prominent/Symbol + Text/1 - Idle | 66×28 | SFPro-Regular 15 | — |
| Buttons/Large/Default/Borderless/Symbol/4 - Disabled | 50×50 | SFPro-Regular 17 | — |
| Buttons/Large/Default/Borderless/Symbol/1 - Idle | 50×50 | SFPro-Regular 17 | — |
| Buttons/Large/Default/Borderless/Text/4 - Disabled | 72×50 | SFPro-Regular 17 | — |
| Buttons/Large/Default/Borderless/Symbol + Text/4 - Disable | 91×50 | SFPro-Regular 17 | — |
| Buttons/Large/Default/Borderless/Symbol + Text/1 - Idle | 91×50 | SFPro-Regular 17 | — |
| Buttons/Medium/Default/Borderless/Symbol/4 - Disabled | 34×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Default/Borderless/Symbol/1 - Idle | 34×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Default/Borderless/Text/4 - Disabled | 56×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Default/Borderless/Symbol + Text/4 - Disabl | 75×34 | SFPro-Regular 17 | — |
| Buttons/Medium/Default/Borderless/Symbol + Text/1 - Idle | 75×34 | SFPro-Regular 17 | — |

## Toolbars
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Toolbars/Top (44pt)/iPhone/Sheet - Title 2 Line Large | 402×141 | — | 2 |
| Toolbars/Top (44pt)/iPhone/Sheet - Large | 402×121 | — | 2 |
| Toolbars/Top (44pt)/iPhone/Sheet - Title 2 Line Left | 402×70 | — | 2 |
| Toolbars/Top (44pt)/iPhone/Sheet - Compact Large | 402×70 | — | 2 |
| Toolbars/Top (44pt)/iPhone/Sheet - Title 2 Line | 402×70 | — | 2 |
| Toolbars/Top (44pt)/iPhone/Sheet - Title | 402×70 | — | 2 |
| Toolbars/Top (44pt)/iPhone/Standard - Title 2 Line Large | 402×125 | — | — |
| Toolbars/Top (44pt)/iPhone/Standard - Large | 402×105 | — | — |
| Toolbars/Top (44pt)/iPhone/Standard - Title 2 Line Left | 402×54 | — | — |
| Toolbars/Top (44pt)/iPhone/Standard - Compact Large | 402×54 | — | — |
| Toolbars/Top (44pt)/iPhone/Standard - Title 2 Line | 402×54 | — | — |
| Toolbars/Top (44pt)/iPhone/Standard - Title | 402×54 | — | — |
| Toolbars/Buttons - Symbol/Selected | 36×36 | SFPro-Medium 17 | 19 |
| Toolbars/Search - Clear Symbol/Clear | 36×36 | SFPro-Medium 17 | — |
| Toolbars/Buttons - Symbol/Default | 36×36 | SFPro-Medium 17 | — |
| Toolbars/Buttons - Symbol/Tinted | 36×36 | SFPro-Medium 17 | — |
| Toolbars/Buttons - Symbol/Disabled | 36×36 | SFPro-Medium 17 | — |
| Toolbars/Buttons - Text/Default | 43×22 | SFPro-Medium 17 | — |
| Toolbars/Buttons - Text/Disabled | 43×22 | SFPro-Medium 17 | — |
| Toolbars/Top (44pt)/Active/Buttons/Symbol 1 - Prominent | 44×44 | SFPro-Medium 17 | — |
| Toolbars/Top (44pt)/Active/Buttons/Symbol 3 | 160×44 | — | — |
| Toolbars/Top (44pt)/Active/Buttons/Symbol 2 | 104×44 | — | — |
| Toolbars/Top (34pt)/Active/Close Button | 34×34 | SFPro-Medium 20 | — |
| Toolbars/Top (44pt)/Active/Buttons/Text | 67×44 | — | — |
| Toolbars/Top (44pt)/Active/Buttons/Back with Title | 80×44 | SFPro-Medium 17, SFPro-Semibold 17 | — |
| Toolbars/Bottom (48pt)/Active/Buttons/Symbol 3 | 164×48 | — | — |
| Toolbars/Bottom (48pt)/Active/Buttons/Symbol 2 | 110×48 | — | — |
| Toolbars/Bottom (48pt)/Active/Buttons/Symbol 1 | 48×48 | — | — |
| Toolbars/Bottom (48pt)/Active/Buttons/Text | 69×48 | — | — |
| Toolbars/Titles - iPad/Large Title | 69×44 | SFPro-Bold 34 | — |
| Toolbars/Titles - iPad/Large Title and Subtitle | 69×61 | SFPro-Bold 34, SFPro-Medium 15 | — |
| Toolbars/Titles - iPad/Title | 35×22 | SFPro-Semibold 17 | — |
| Toolbars/Titles - iPad/Title and Subtitle (Left) | 46×38 | SFPro-Medium 12, SFPro-Semibold 17 | — |
| Toolbars/Titles - iPad/Title and Subtitle | 46×38 | SFPro-Medium 12, SFPro-Semibold 17 | — |
| Toolbars/Titles - iPhone/Large Title | 69×41 | SFPro-Bold 34 | — |
| Toolbars/Titles - iPhone/Large Title and Subtitle | 69×61 | SFPro-Bold 34, SFPro-Medium 15 | — |
| Toolbars/Titles - iPhone/Title | 35×22 | SFPro-Semibold 17 | — |
| Toolbars/Titles - iPhone/Title and Subtitle (Left) | 46×39 | SFPro-Medium 12, SFPro-Semibold 15 | — |
| Toolbars/Titles - iPhone/Title and Subtitle | 46×39 | SFPro-Medium 12, SFPro-Semibold 15 | — |
| Toolbars/Segmented Control Buttons/Unselected | 74×36 | SFPro-Medium 14 | — |

## Tab Bars
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Tab Bars/iPhone/Tab - Search | 54×54 | SFPro-Semibold 17 | — |
| Tab Bars/iPhone/Tab - Default/Default | 72×54 | SFPro-Semibold 10, SFPro-Semibold 18 | — |
| Tab Bars/iPhone/Tab - Default/Selected | 72×54 | SFPro-Semibold 10, SFPro-Semibold 18 | 3.402823466385289e+38 |
| Tab Bars/iPad/Tab - Symbol/Unselected | 52×36 | SFPro-Medium 17 | — |
| Tab Bars/iPad/Tab - Symbol/Selected | 52×36 | SFPro-Semibold 17 | — |
| Tab Bars/iPad/Tab - Label/Unselected | 65×36 | SFPro-Medium 17 | — |
| Tab Bars/iPad/Tab - Label/Selected | 74×36 | SFPro-Semibold 17 | — |
| Tab Bars/iPad (Regular)/iPad | 510×44 | — | — |
| Tab Bars/iPhone/Tabs - Search/5 Tabs | 346×62 | — | — |
| Tab Bars/iPhone/Tabs - Search/4 Tabs | 346×62 | — | — |
| Tab Bars/iPhone/Tabs - Search/2 Tabs | 346×62 | — | — |
| Tab Bars/iPhone/Tabs - Search/3 Tabs | 346×62 | — | — |
| Tab Bars/iPhone/Tabs - No Search/5 Tabs | 346×62 | — | — |
| Tab Bars/iPhone/Tabs - No Search/4 Tabs | 346×62 | — | — |
| Tab Bars/iPhone/Tabs - No Search/3 Tabs | 346×62 | — | — |
| Tab Bars/iPhone/Tabs - No Search/2 Tabs | 346×62 | — | — |
| Tab Bars/iPhone/Search Selected - Typing | 402×394 | SFPro-Medium 17 | — |
| Tab Bars/iPhone/Search Selected - Value | 402×76 | — | — |
| Tab Bars/iPhone/Search Selected - Placeholder | 402×76 | — | — |
| Tab Bars/iPhone/Prominent Tab | 402×99 | — | — |
| Tab Bars/iPhone/Default | 402×99 | — | — |

## Sheets
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Sheets/iPad | 1210×834 | — | — |
| Sheets (iPhone)/Overlay/Light | 200×200 | — | — |
| Sheets/iPhone/Inspector | 402×460 | — | — |
| Sheets/iPhone/Medium Detent | 402×874 | — | — |
| Sheets/iPhone/Large Detent | 402×874 | — | — |

## Alerts
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Alerts/3 Destructive | 120×48 | SFPro-Medium 17 | — |
| Alerts/2 Secondary | 120×48 | SFPro-Medium 17 | — |
| Alerts/1 Primary | 120×48 | SFPro-Semibold 17 | — |
| Alerts/Buttons Stacked | 300×304 | SFPro-Regular 17, SFPro-Semibold 17 | — |
| Alerts/Input Field x 2 | 300×307 | SFPro-Regular 17, SFPro-Semibold 17 | — |
| Alerts/Input Field x 1 | 300×255 | SFPro-Regular 17, SFPro-Semibold 17 | — |
| Alerts/Default | 300×184 | SFPro-Regular 17, SFPro-Semibold 17 | — |
| Alerts/Overlay | 200×200 | — | — |

## Action Sheets
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Action Sheets/Light | 260×524 | SFPro-Regular 15, SFPro-Semibold 17 | — |

## Text Fields
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Text Fields/Cursor | 4×22 | — | 2 |
| Text Fields/Typing | 288×52 | SFPro-Medium 17, SFPro-Regular 24 | — |
| Text Fields/Default | 288×52 | SFPro-Medium 17 | — |
| Text Fields/Empty Typing | 288×52 | — | — |
| Text Fields/Placeholder | 288×52 | SFPro-Medium 17 | — |

## Segmented Controls
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Segmented Controls/1 - Unselected | 80×28 | SFPro-Medium 13.333 | — |
| Segmented Controls/3 - Touch | 80×28 | SFPro-Medium 13.333 | — |
| Segmented Controls/5 - Selected | 80×28 | SFPro-Semibold 13.3333 | — |
| Segmented Controls/Large/4 - Disabled | 370×48 | — | — |
| Segmented Controls/Large/1 - Enabled | 370×48 | — | — |
| Segmented Controls/Small/4 - Disabled | 370×32 | — | — |
| Segmented Controls/Small/1 - Enabled | 370×32 | — | — |
| Segmented Controls/Glass/Light | 59×37 | — | 50, 3.402823466385289e+38 |

## Menus
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Edit Menu/Selection | 40×28 | — | — |
| Edit Menu/Text Selection | 40×22 | — | 1 |
| Edit Menu/Menu Indicator | 36×36 | SFPro-Semibold 15 | — |
| Edit Menu/Action/Default | 64×18 | SFPro-Regular 15 | — |
| Edit Menu/Action/Destructive | 64×18 | SFPro-Regular 15 | — |
| Edit Menu/Light | 504×44 | — | — |
| Menus/iPad | 238×468 | — | — |
| Menus/iPad with Shortcuts | 238×501 | — | — |
| Menus/iPad/Section Title | 206×27 | SFPro-Medium 12 | — |
| Menus/iPad/Separator | 208×17 | — | — |
| Menus/iPad/Selection/Hide | 230×42 | — | — |
| Menus/iPad/Selection/Show | 230×42 | — | 18 |
| Menus/iPad/Quick Action/Selection/Show | 68×56 | — | 18 |
| Menus/iPad/Right Accessory/Submenu | 9×20 | SFPro-Bold 15 | — |
| Menus/iPad/Menu Item Symbol/Show | 24×20 | SFPro-Regular 15 | — |
| Menus/iPad/Menu Item Symbol/Hide | 24×20 | — | — |
| Menus/iPad/Quick Action Symbol | 22×22 | SFPro-Regular 15 | — |
| Menus/iPad/Right Accessory/Keyboard Shortcut | 76×16 | SFPro-Medium 15 | — |
| Menus/iPad/Right Accessory/Shortcuts/Command (􀆔) | 14×16 | SFPro-Medium 15 | — |
| Menus/iPad/Right Accessory/Shortcuts/Shift (􀆝) | 14×16 | SFPro-Medium 15 | — |
| Menus/iPad/Right Accessory/Shortcuts/Option (􀆕) | 14×16 | SFPro-Medium 15 | — |
| Menus/iPad/Right Accessory/Shortcuts/Control (􀆍) | 14×16 | SFPro-Medium 15 | — |
| Menus/iPad/Menu Item - Selectable/Title + Subtitle, Disabl | 198×54 | SFPro-Regular 13, SFPro-Regular 15, SFPro-Semibold 13 | — |
| Menus/iPad/Menu Item - Selectable/Title + Subtitle, Defaul | 198×54 | SFPro-Regular 13, SFPro-Regular 15, SFPro-Semibold 13 | — |
| Menus/iPad/Menu Item/Title + Subtitle, Destructive | 198×54 | SFPro-Regular 13, SFPro-Regular 15 | — |
| Menus/iPad/Menu Item/Title + Subtitle, Disabled | 198×54 | SFPro-Regular 13, SFPro-Regular 15 | — |
| Menus/iPad/Menu Item/Title + Subtitle, Default | 198×54 | SFPro-Regular 13, SFPro-Regular 15 | — |
| Menus/iPad/Menu Item - Selectable/Title, Disabled | 198×38 | SFPro-Regular 15, SFPro-Semibold 13 | — |
| Menus/iPad/Menu Item - Selectable/Title, Default | 198×38 | SFPro-Regular 15, SFPro-Semibold 13 | — |
| Menus/iPad/Menu Item/Title, Destructive | 198×38 | SFPro-Regular 15 | — |
| Menus/iPad/Menu Item/Title, Disabled | 198×38 | SFPro-Regular 15 | — |
| Menus/iPad/Menu Item/Title, Default | 198×38 | SFPro-Regular 15 | — |
| Menus/iPad/Quick Action/Destructive | 68×50 | SFPro-Medium 12 | — |
| Menus/iPad/Quick Action/Default | 68×50 | SFPro-Medium 12 | — |
| Menus/iPhone/Section Title | 210×27 | SFPro-Medium 13 | — |
| Menus/iPhone/Separator | 210×21 | — | — |
| Menus/Overlay | 100×100 | — | — |
| Menus/iPhone | 250×573 | — | — |
| Menus/Content View | 370×370 | SFPro-Regular 17 | — |
| Menus/BG Selection/Hide | 100×100 | — | — |

## Sidebars
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Sidebar/Items/Trailing/Toggle | 64×44 | — | — |
| Sidebar/Items/Trailing/Symbol | 83×44 | SFPro-Regular 17 | — |
| Sidebar/Items/Trailing/Submenu | 74×44 | SFPro-Regular 17 | — |
| Sidebar/Items/Trailing/Checkmark | 82×44 | SFPro-Regular 17 | — |
| Sidebar/Items/Trailing/Detail only | 52×44 | SFPro-Regular 17 | — |
| Sidebar/Items/Leading/Symbols | 34×36 | SFPro-Regular 17 | — |
| Sidebar/Items/Leading/Titles | 47×36 | SFPro-Regular 13, SFPro-Regular 17 | — |
| Sidebar/Items/Leading/Delete Button | 29×36 | — | — |
| Sidebar/Items/Leading/Composed | 124×44 | — | — |
| Sidebar/States/Disabled | 260×44 | — | — |
| Sidebar/States/Selected | 260×44 | — | — |
| Sidebar/States/Default | 260×44 | — | — |
| Sidebar/Items/Level 2 | 260×44 | — | — |
| Sidebar/Items/Level 1 | 260×44 | — | — |
| Sidebar/Items/Level 0 | 260×44 | — | — |
| Sidebar/Submenu/Open | 18×18 | SFPro-Bold 13 | — |
| Sidebar/Submenu/Closed | 18×18 | SFPro-Bold 13 | — |
| Sidebar/Header/Header | 260×54 | SFPro-Medium 17, SFPro-Regular 17 | — |
| Sidebar/Search/Value | 180×64 | SFPro-Medium 17 | — |
| Sidebar/Navigation Bar/Button Text | 32×22 | SFPro-Medium 17 | — |
| Sidebar/Navigation Bar/Button Symbol | 28×22 | SFPro-Medium 17 | — |
| Sidebar/BG/Active | 100×100 | — | — |
| Sidebar/Toolbar/Fullscreen | 320×54 | — | — |
| Sidebar/Toolbar/Floating Window | 320×54 | — | — |

## Popovers
| 컴포넌트 | W×H | 폰트 | 라디우스 |
|---|---|---|---|
| Popovers (iPad Only)/Bottom Trailing | 130×130 | — | 13 |
| Popovers (iPad Only)/Bottom Middle | 130×130 | — | 13 |
| Popovers (iPad Only)/Bottom Leading | 130×130 | — | 13 |
| Popovers (iPad Only)/Trailing Bottom | 130×130 | — | 13 |
| Popovers (iPad Only)/Top Leading | 130×130 | — | 13 |
| Popovers (iPad Only)/Top Middle | 130×130 | — | 13 |
| Popovers (iPad Only)/Top Trailing | 130×130 | — | 13 |
| Popovers (iPad Only)/Light - Presentation Controller | 280×280 | — | — |
