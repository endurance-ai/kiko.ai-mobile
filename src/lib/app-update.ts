import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

import { BASE_URL } from '@/lib/api';
import type { AppConfig } from '@/types/api';

/**
 * 앱 업데이트 게이트 로직 — 두 축.
 *
 *  A) OTA(JS 번들): expo-updates 로 새 번들을 받아 그 자리서 적용(reload).
 *     JS/에셋만 바뀐 릴리스는 스토어 심사 없이 이 경로로 전달된다.
 *  B) 스토어(네이티브 바이너리): 백엔드가 주는 min/latest 버전과 설치 버전을
 *     비교해 강제/권장 업데이트 모달을 띄우고 App Store 로 보낸다.
 *
 * 모든 함수는 fail-open — 네트워크/플랫폼 문제로 절대 앱을 막지 않는다.
 */

/**
 * 설치된 앱(네이티브 바이너리) 버전. runtimeVersion 정책이 `appVersion` 이라
 * OTA 번들도 항상 바이너리와 동일한 version 을 가지므로 이 값은 신뢰 가능하다.
 */
export function getInstalledVersion(): string {
  return (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';
}

/** "1.2.3" 형태 비교. a<b → -1, a==b → 0, a>b → 1. 숫자 외 토큰은 0 취급. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

/**
 * 스토어 버전 설정을 백엔드에서 조회. 실패하면 null(fail-open — 게이트를
 * 비활성). 로그인 전에도 떠야 하므로 인증 없이 plain fetch 를 쓴다.
 */
export async function fetchAppConfig(): Promise<AppConfig | null> {
  try {
    const res = await fetch(`${BASE_URL}/v1/app/config`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as AppConfig;
  } catch {
    return null;
  }
}

export type StoreGate =
  | { kind: 'blocked'; storeUrl: string } // 설치 < min → 강제(차단)
  | { kind: 'soft'; storeUrl: string } // min ≤ 설치 < latest → 권장(닫기 가능)
  | { kind: 'none' };

/** 설치 버전 vs min/latest 로 스토어 게이트 상태 산출. */
export function evaluateStoreGate(cfg: AppConfig | null): StoreGate {
  const ios = cfg?.ios;
  if (!ios) return { kind: 'none' };
  const installed = getInstalledVersion();
  if (ios.min_version && compareVersions(installed, ios.min_version) < 0) {
    return { kind: 'blocked', storeUrl: ios.store_url };
  }
  if (ios.latest_version && compareVersions(installed, ios.latest_version) < 0) {
    return { kind: 'soft', storeUrl: ios.store_url };
  }
  return { kind: 'none' };
}

/**
 * OTA 업데이트 확인 + 다운로드. 새 번들을 받아 적용 대기 상태면 true.
 * dev / Expo Go / updates 비활성 환경은 조용히 false. 절대 throw 하지 않음.
 */
export async function checkAndFetchOta(): Promise<boolean> {
  if (__DEV__ || !Updates.isEnabled) return false;
  try {
    const check = await Updates.checkForUpdateAsync();
    if (!check.isAvailable) return false;
    const fetched = await Updates.fetchUpdateAsync();
    return fetched.isNew;
  } catch {
    return false;
  }
}

/** 받아둔 OTA 번들로 재시작(그 자리서 새 JS 적용). 실패해도 무해. */
export async function applyOtaAndReload(): Promise<void> {
  try {
    await Updates.reloadAsync();
  } catch {
    // no-op — 다음 콜드 런치에 자연 적용된다.
  }
}
