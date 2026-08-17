/**
 * 온보딩 로컬 상태 — 로그인 전(익명) 단계에서 받은 성별·취향 브랜드를 보관.
 *
 * 저장소는 AsyncStorage: 민감정보가 아니고, iOS Keychain(secure-store)과 달리
 * 앱 삭제 시 양 플랫폼 모두 깨끗하게 사라져 재설치 유저의 stale 값 충돌이
 * 없다. Keychain 은 토큰 전용으로 남긴다.
 *
 * 수명: 로그인 성공 시점에 promoteOnboardingToServer() 로 서버 프로필
 * (POST /v1/onboarding)에 승격하고 로컬 값은 캐시로만 유지한다. 승격은
 * 전체 교체(replace) — 온보딩 플로우를 실제로 통과한 유저만 이 경로를
 * 타므로 "재확인 후 갱신"이라는 서버 계약과 일치한다. 재설치한 기존
 * 계정 유저는 온보딩 게이트(index.tsx)를 건너뛰어 승격도 일어나지 않고,
 * 취향은 서버 프로필이 source of truth 로 남는다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from '@/lib/api';
import type { OnboardingRequest, OnboardingResponse } from '@/types/api';

export type OnboardingGender = 'women' | 'men';

/** 취향 픽 1건 — id 는 public.brand_nodes.id. 서버 해석에 실패한 검색
 * 폴백 픽은 id: null 로 로컬에만 남는다 (승격 시 제외). */
export type OnboardingBrandPick = {
  id: number | null;
  name: string;
};

const DONE_KEY = 'kiko:onboarding:done:v1';
const GENDER_KEY = 'kiko:onboarding:gender:v1';
// v2 — 픽이 string[] 에서 {id, name}[] 으로 바뀜 (POST /v1/onboarding 은
// brand_id 를 요구). v1 키의 이름 배열은 id 가 없어 승격에 못 쓰므로
// 마이그레이션 없이 버린다 (프로토타입 로컬값).
const BRANDS_KEY = 'kiko:onboarding:brands:v2';
const PROMOTED_KEY = 'kiko:onboarding:promoted:v1';

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

export async function readOnboardingBrands(): Promise<OnboardingBrandPick[]> {
  try {
    const raw = await AsyncStorage.getItem(BRANDS_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is OnboardingBrandPick =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as OnboardingBrandPick).name === 'string' &&
        (typeof (p as OnboardingBrandPick).id === 'number' ||
          (p as OnboardingBrandPick).id === null),
    );
  } catch {
    return [];
  }
}

export async function saveOnboarding(payload: {
  gender: OnboardingGender | null;
  brands: OnboardingBrandPick[];
}): Promise<void> {
  try {
    const ops: [string, string][] = [[DONE_KEY, 'true']];
    if (payload.gender) ops.push([GENDER_KEY, payload.gender]);
    ops.push([BRANDS_KEY, JSON.stringify(payload.brands)]);
    // 값이 갱신됐으니 다음 로그인에서 다시 승격
    ops.push([PROMOTED_KEY, 'false']);
    await AsyncStorage.multiSet(ops);
  } catch {
    // 저장 실패는 치명적이지 않음 — 다음 실행에서 온보딩이 한 번 더 뜰 뿐
  }
}

/**
 * 로컬 온보딩값 → 서버 프로필 승격 (POST /v1/onboarding, auth 필수).
 *
 * 로그인 성공 직후 fire-and-forget 으로 호출한다. 멱등: 성공하면 promoted
 * 플래그를 세워 이후 세션 복원에서 재전송하지 않고, 실패하면 플래그를
 * 남겨두지 않아 다음 로그인/복원 때 자연 재시도된다. 존재하지 않는
 * brand_id 는 서버가 조용히 제외하므로 응답의 saved_brand_ids 로 검증하지
 * 않는다.
 */
export async function promoteOnboardingToServer(): Promise<void> {
  try {
    const [done, promoted, gender] = await Promise.all([
      readOnboardingDone(),
      AsyncStorage.getItem(PROMOTED_KEY),
      readOnboardingGender(),
    ]);
    if (!done || promoted === 'true' || !gender) return;

    const brands = await readOnboardingBrands();
    const body: OnboardingRequest = {
      gender,
      selected_brand_ids: brands
        .map((b) => b.id)
        .filter((id): id is number => id !== null),
    };
    await api.post<OnboardingResponse>('/v1/onboarding', body);
    await AsyncStorage.setItem(PROMOTED_KEY, 'true');
  } catch {
    // 네트워크/401 등 — 다음 로그인 성공 시 재시도
  }
}
