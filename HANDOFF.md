# KikoAI Mobile 인수인계 문서

## 1. 프로젝트 개요

- **레포**: https://github.com/endurance-ai/kiko.ai-mobile
- **로컬 경로**: `~/Desktop/kikoai-mobile`
- **스택**: Expo SDK 56 / React Native 0.85 / React 19 / TypeScript / expo-router (file-based routing)
- **패키지 매니저**: `pnpm@10.18.3` (⚠️ npm/yarn 쓰지 말 것. `pnpm-lock.yaml` 기준)
- **앱 정보**
  - 이름: `Kiko AI`, slug: `kikoai-mobile`, scheme: `kikoaimobile`
  - iOS bundle: `com.kikoai.app`, Android package: `com.kikoai.app`
  - EAS projectId: `3eca8caa-f979-4d07-8a63-d418df878533` (owner: `chldbsdud`)
  - App Store Connect App ID: `6787153872`

## 2. 사전 준비

### 필수 도구
```bash
# Node (Expo 56 → Node 20+ 권장)
node -v

# pnpm
npm install -g pnpm@10.18.3

# EAS CLI (클라우드 빌드/배포용)
npm install -g eas-cli
eas login   # Expo 계정: chldbsdud
```

### iOS 로컬 빌드용 (Mac 필수)
- Xcode 최신 (iOS deploymentTarget `16.4`)
- CocoaPods: `sudo gem install cocoapods` 또는 `brew install cocoapods`
- iOS Simulator

### Android 로컬 빌드용
- Android Studio + SDK
- JDK 17
- `ANDROID_HOME` 환경변수 세팅

### 환경변수 (`.env`, 레포에 커밋 X)
```
EXPO_PUBLIC_AMPLITUDE_API_KEY=...
```
현재 `.env`에는 Amplitude 키 하나만 있음. API base URL은 `app.json`의 `extra.apiBaseUrl` (`https://dev-ai.kikoai.me`)에서 읽어옴 (`src/lib/api.ts` 참고).

## 3. 초기 설치

```bash
cd ~/Desktop/kikoai-mobile
pnpm install
```

`patches/expo-share-extension@6.0.0-beta.patch`가 자동 적용됨 (pnpm의 patchedDependencies).

## 4. 개발 서버 실행

### Metro 번들러 (Dev 서버 열기)
```bash
pnpm start
# 또는
npx expo start

# 캐시 꼬였을 때
npx expo start --clear

# 실기기(같은 Wi-Fi) 연결 안될 때 터널 모드
npx expo start --tunnel

# LAN / localhost 강제
npx expo start --lan
npx expo start --localhost

# dev-client 빌드에 붙일 때 (Expo Go 아닌 커스텀 dev 앱)
npx expo start --dev-client

# 포트 바꾸기 (기본 8081)
npx expo start --port 8082
```
Metro가 뜨면 터미널에서 `i`(iOS), `a`(Android), `r`(reload), `j`(devtools) 단축키 사용.

### iOS 시뮬레이터에서 실행 (네이티브 빌드 포함)
```bash
pnpm ios
# 또는
npx expo run:ios
```
`ios/Pods`가 없거나 네이티브 의존성이 바뀐 경우 자동으로 `pod install` 수행. 실기기 지정:
```bash
npx expo run:ios --device
```

### Android 실행
```bash
pnpm android
# 또는
npx expo run:android
```

### 웹 (참고용 — 주요 타깃 아님)
```bash
pnpm web
```

### 린트
```bash
pnpm lint
```

## 5. 네이티브 프로젝트 재생성 (prebuild)

`app.json` 플러그인이나 네이티브 설정을 바꿨을 때:
```bash
npx expo prebuild            # ios/, android/ 갱신
npx expo prebuild --clean    # 완전 재생성 (주의: 커스텀 네이티브 코드 있으면 백업)
```
> 현재 레포에는 `ios/`, `android/` 디렉토리가 커밋되어 있음. 순수 관리형이 아니라 하이브리드 워크플로우.

## 6. iOS 프로덕션 빌드 — Xcode에서 직접 Archive (우리 팀 방식)

> ⚠️ **우리 팀은 iOS 프로덕션 빌드를 EAS build로 안 돌리고 Xcode에서 직접 Archive 함.** 아래 순서 따를 것.

### 사전 준비
```bash
cd ~/Desktop/kikoai-mobile

# 1) JS 의존성
pnpm install

# 2) 네이티브 설정 바꿨거나 처음이면 prebuild
npx expo prebuild            # (필요할 때만. 이미 ios/ 있으면 스킵 가능)

# 3) CocoaPods 설치
cd ios && pod install && cd ..
```

### Xcode 오픈 & Archive
```bash
# 반드시 .xcworkspace 로 열 것 (.xcodeproj X)
open ios/kikoaimobile.xcworkspace
```

Xcode에서:
1. 타깃: `kikoaimobile` 선택
2. 상단 디바이스 셀렉터를 **`Any iOS Device (arm64)`** 로 변경 (시뮬레이터 아님)
3. Scheme을 **Release** 로: `Product → Scheme → Edit Scheme… → Run → Build Configuration = Release`
4. 버전/빌드 넘버 확인:
   - `app.json`의 `version` → Xcode `Marketing Version`
   - iOS build number(`CFBundleVersion`)는 스토어 제출마다 1씩 올려야 함
5. **Product → Archive**
6. Archive 완료되면 Organizer 창이 뜸 → **Distribute App**
   - App Store Connect 제출: `App Store Connect → Upload`
   - Ad-hoc/내부 배포: `TestFlight & App Store` 또는 `Ad Hoc`
7. Signing: `Automatically manage signing` 체크, Team 선택 (Kiko AI 팀 인증서 필요)

### Archive 전 체크리스트
- [ ] `.env`의 프로덕션 값 확인 (Amplitude 키 등)
- [ ] `app.json` `extra.apiBaseUrl` — 프로덕션이면 프로덕션 URL로 스위칭했는지 확인
- [ ] `app.json` `version` 올림
- [ ] iOS build number 올림
- [ ] `pnpm install` 최신 상태
- [ ] `pod install` 재실행 (네이티브 dep 바꿨을 때)

### Xcode Archive 트러블슈팅
```bash
# Pods 완전 재설치
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..

# DerivedData 날리기 (Xcode 이상할 때)
rm -rf ~/Library/Developer/Xcode/DerivedData

# 빌드 캐시
cd ios && xcodebuild clean && cd ..
```

## 7. 클라우드 빌드 (EAS) — 개발/프리뷰 용도

`eas.json`에 정의된 프로파일:

| 프로파일 | 용도 | 특징 |
|---|---|---|
| `development` | 시뮬레이터용 dev client | `simulator: true`, `developmentClient: true`, channel `development` |
| `development-device` | 실기기 dev client | `simulator: false`, channel `development-device` |
| `preview` | 내부 배포 (TestFlight/APK) | channel `preview` |
| `production` | 스토어 제출용 | `autoIncrement: true`, channel `production` |

### 빌드 명령
```bash
# 개발용 (실기기)
eas build --profile development-device --platform ios
eas build --profile development-device --platform android

# 프리뷰
eas build --profile preview --platform ios
eas build --profile preview --platform android

# 프로덕션
eas build --profile production --platform ios
eas build --profile production --platform android

# 양 플랫폼 동시
eas build --profile production --platform all
```

### 스토어 제출
```bash
# iOS (App Store Connect ascAppId: 6787153872 이미 설정됨)
eas submit --profile production --platform ios --latest

# Android (Play Console 자격증명 별도 세팅 필요)
eas submit --profile production --platform android --latest
```

### OTA 업데이트 (JS만 바뀐 경우, 네이티브 빌드 불필요)
```bash
eas update --branch production --message "설명"
eas update --branch preview    --message "설명"
```
`runtimeVersion.policy: appVersion`이므로 앱 버전(`app.json` `version`)이 같은 빌드에만 업데이트가 나감. 네이티브 변경(플러그인 추가 등) 시 새 빌드 필수.

## 8. 트러블슈팅 자주 쓰는 명령

```bash
# node_modules / 캐시 초기화
rm -rf node_modules
pnpm install
npx expo start --clear

# iOS 파드 재설치
cd ios && pod install && cd ..

# iOS 완전 클린 빌드
cd ios && xcodebuild clean && cd ..
rm -rf ios/build

# Watchman 캐시
watchman watch-del-all

# EAS 상태 확인
eas build:list --limit 5
eas whoami
```

## 9. 프로젝트 구조 (핵심만)

```
kikoai-mobile/
├── index.js                  # 앱 엔트리
├── index.share.js            # Share Extension 엔트리
├── ShareExtension.tsx        # iOS Share Extension UI
├── app.json                  # Expo 설정 (플러그인, extra, EAS)
├── eas.json                  # EAS 빌드 프로파일
├── src/
│   ├── app/                  # expo-router 라우트 (file-based)
│   ├── components/
│   ├── constants/
│   ├── hooks/
│   ├── lib/                  # api.ts (BASE_URL: dev-ai.kikoai.me), sse, chat, uploads 등
│   ├── state/                # 전역 상태
│   └── types/
├── ios/                      # prebuild 산출물 (커밋됨)
├── android/                  # prebuild 산출물 (커밋됨)
├── assets/                   # 아이콘, 스플래시
├── patches/                  # expo-share-extension 패치
└── scripts/reset-project.js
```

## 10. 주요 연동 서비스

- **AI 백엔드**: `https://dev-ai.kikoai.me` (dev). 프로덕션 URL 확인 필요 시 `app.json` `extra.apiBaseUrl` 스위칭 로직/서버 팀 확인
- **Google OAuth**: clientId `205071192266-...` (`app.json` `extra.googleClientId`, iOS CFBundleURLSchemes에도 등록됨)
- **Apple Sign-In**: `expo-apple-authentication`, `usesAppleSignIn: true`
- **Amplitude**: `.env`의 `EXPO_PUBLIC_AMPLITUDE_API_KEY`
- **Push**: `expo-notifications`
- **OTA**: `https://u.expo.dev/3eca8caa-f979-4d07-8a63-d418df878533`

## 11. 처음 인수받으면 이 순서대로

1. `pnpm install`
2. `.env` 파일 받아서 루트에 배치
3. `eas login` (Expo 계정 공유 받기)
4. iOS 시뮬레이터: `pnpm ios` — 첫 실행은 pod install + Xcode 빌드로 10~20분 걸릴 수 있음
5. 정상 뜨면 `pnpm start`로 개발 시작
6. iOS 프로덕션 배포 필요 시: `open ios/kikoaimobile.xcworkspace` → Xcode에서 직접 Archive (섹션 6 참고)
7. 개발 빌드는 EAS로: `eas build --profile development --platform ios`

---

⚠️ 참고: `AGENTS.md`에 "Expo가 크게 바뀌었으니 코드 쓰기 전 https://docs.expo.dev/versions/v56.0.0/ 정확한 버전 문서 먼저 볼 것"이라고 명시되어 있음. SDK 56 기준으로 작업할 것.
