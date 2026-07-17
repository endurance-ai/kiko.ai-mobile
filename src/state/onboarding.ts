/**
 * 온보딩 로컬 상태 — 로그인 전(익명) 단계에서 받은 성별·취향 브랜드를 보관.
 *
 * 저장소는 AsyncStorage: 민감정보가 아니고, iOS Keychain(secure-store)과 달리
 * 앱 삭제 시 양 플랫폼 모두 깨끗하게 사라져 재설치 유저의 stale 값 충돌이
 * 없다. Keychain 은 토큰 전용으로 남긴다.
 *
 * 수명: 로그인 성공 시점에 서버 프로필(POST /v1/onboarding — AI 서버
 * taste_profile.gender)로 승격하고 로컬 값은 캐시로만 유지한다. 승격 정책:
 * 서버에 이미 값이 있으면 서버가 이긴다(재로그인 유저의 설정 보호).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type OnboardingGender = 'women' | 'men';

const DONE_KEY = 'kiko:onboarding:done:v1';
const GENDER_KEY = 'kiko:onboarding:gender:v1';
const BRANDS_KEY = 'kiko:onboarding:brands:v1';

export async function readOnboardingDone(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DONE_KEY)) === 'true';
  } catch {
    // 저장소 불능 시 fail-open: 온보딩을 다시 보여주는 쪽이 안전
    return false;
  }
}

export async function readOnboardingGender(): Promise<OnboardingGender | null> {
  try {
    const v = await AsyncStorage.getItem(GENDER_KEY);
    return v === 'women' || v === 'men' ? v : null;
  } catch {
    return null;
  }
}

export async function readOnboardingBrands(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(BRANDS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((b): b is string => typeof b === 'string') : [];
  } catch {
    return [];
  }
}

export async function saveOnboarding(payload: {
  gender: OnboardingGender | null;
  brands: string[];
}): Promise<void> {
  try {
    const ops: [string, string][] = [[DONE_KEY, 'true']];
    if (payload.gender) ops.push([GENDER_KEY, payload.gender]);
    ops.push([BRANDS_KEY, JSON.stringify(payload.brands)]);
    await AsyncStorage.multiSet(ops);
  } catch {
    // 저장 실패는 치명적이지 않음 — 다음 실행에서 온보딩이 한 번 더 뜰 뿐
  }
}
