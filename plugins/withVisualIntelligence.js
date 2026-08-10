const { withXcodeProject, withInfoPlist } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * KIKO Visual Intelligence (iOS 26) config plugin.
 *
 * Expo prebuild 는 `ios/` 를 재생성하므로, 매 prebuild 마다
 *   1) 순정 Swift 를 `ios/<앱>/KikoVisualIntelligence.swift` 로 복사 + 앱 타깃 Sources 등록
 *   2) Info.plist 에 KIKO_API_BASE_URL(env) 주입 — Swift 가 서버 주소를 읽음
 *   3) base URL 이 http:// 면 dev 용 ATS 예외(NSAllowsArbitraryLoads) 추가
 * 해서 `expo prebuild --clean` 에도 살아남게 한다.
 *
 * 원본 Swift: plugins/visual-intelligence/KikoVisualIntelligence.swift
 *
 * env (prebuild 전 export):
 *   KIKO_API_BASE_URL   예) http://192.168.0.12:8000 (로컬 실기기 테스트) — 미설정 시 dev.
 *
 * NOTE: 별도 익스텐션 타깃 없음(Apple 공식 패턴 = 메인 앱 내 App Intents).
 */
const SWIFT_FILENAME = 'KikoVisualIntelligence.swift';

const withSwiftSource = (config) =>
  withXcodeProject(config, (config) => {
    const proj = config.modResults;
    const iosRoot = config.modRequest.platformProjectRoot; // .../ios
    const appName = config.modRequest.projectName; // 'KikoAI'

    // 1) 원본 Swift → ios/<앱>/ 로 복사
    const templatePath = path.join(__dirname, 'visual-intelligence', SWIFT_FILENAME);
    const destDir = path.join(iosRoot, appName);
    fs.mkdirSync(destDir, { recursive: true });
    fs.copyFileSync(templatePath, path.join(destDir, SWIFT_FILENAME));

    // 2) pbxproj 등록 (멱등)
    const relPath = `${appName}/${SWIFT_FILENAME}`;
    if (!proj.hasFile(relPath)) {
      const target = proj.getFirstTarget().uuid; // 메인 앱 타깃 (첫 타깃)
      const groupKey =
        proj.findPBXGroupKey({ name: appName }) ||
        proj.getFirstProject().firstProject.mainGroup;
      proj.addSourceFile(relPath, { target }, groupKey);
    }
    return config;
  });

const withApiConfig = (config) =>
  withInfoPlist(config, (config) => {
    const baseURL = process.env.KIKO_API_BASE_URL || '';
    if (baseURL) {
      config.modResults.KIKO_API_BASE_URL = baseURL;
    }
    // 로컬 실기기 테스트는 http://<맥 LAN IP>:8000 → ATS 가 기본 차단하므로 dev 예외.
    // https(dev/prod)면 예외를 넣지 않는다.
    if (baseURL.startsWith('http://')) {
      config.modResults.NSAppTransportSecurity = {
        ...(config.modResults.NSAppTransportSecurity || {}),
        NSAllowsArbitraryLoads: true,
      };
    }
    return config;
  });

// prebuild --clean 이 서명 설정을 리셋 → 매번 Xcode 에서 팀 재선택하는 문제 방지.
// bundle id 가 있는 모든 타깃(앱 + 셰어 익스텐션)에 자동서명 + 팀을 박는다.
// 팀은 env(KIKO_APPLE_TEAM_ID)로 덮을 수 있고, 기본값은 현재 프로젝트 팀.
//
// ⚠️ EAS Build 는 자체 관리형 배포 크레덴셜/프로파일로 서명하므로, 여기서
// CODE_SIGN_STYLE=Automatic + 팀을 강제하면 충돌한다. EAS 환경(EAS_BUILD)에서는
// 주입을 건너뛰고 EAS 서명에 맡긴다 — 로컬 Xcode prebuild 편의용으로만 주입.
const withAutoSigning = (config) => {
  if (process.env.EAS_BUILD) return config;
  return withXcodeProject(config, (config) => {
    const teamId = process.env.KIKO_APPLE_TEAM_ID || 'T6WGA33SML';
    const proj = config.modResults;
    const buildConfigs = proj.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(buildConfigs)) {
      const entry = buildConfigs[key];
      const bs = entry && typeof entry === 'object' ? entry.buildSettings : null;
      if (bs && bs.PRODUCT_BUNDLE_IDENTIFIER) {
        bs.DEVELOPMENT_TEAM = teamId;
        bs.CODE_SIGN_STYLE = 'Automatic';
      }
    }
    return config;
  });
};

const withVisualIntelligence = (config) =>
  withAutoSigning(withApiConfig(withSwiftSource(config)));

module.exports = withVisualIntelligence;
