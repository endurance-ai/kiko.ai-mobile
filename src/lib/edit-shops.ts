import { api } from '@/lib/api';
import type {
  EditShopFiltersResponse,
  EditShopProductsResponse,
} from '@/types/api';

// 편집샵 API — ai-server app/api/edit_shops.py (GET /v1/edit-shops/{platform}/…).
// gender 는 필수(women|men), 서버가 unisex 를 선택 성별에 병합해 반환한다.

/** '전체' 카테고리 키 — 서버 ALL_CATEGORY. category 미지정 시 서버 기본값과 동일. */
export const EDIT_SHOP_ALL_CATEGORY = 'all';

/** 편집샵 플랫폼 키 — ai-server EDIT_SHOP_PLATFORMS 와 동일(홈 배너 매핑용). */
export const EDIT_SHOP_PLATFORMS = [
  'slowsteadyclub',
  '8division',
  'etcseoul',
  'fr8ight',
  'kith',
] as const;
export type EditShopPlatform = (typeof EDIT_SHOP_PLATFORMS)[number];

/** 편집샵 메타 + 성별/카테고리 필터. */
export function getEditShopFilters(
  platform: string,
  gender: 'women' | 'men',
): Promise<EditShopFiltersResponse> {
  return api.get<EditShopFiltersResponse>(
    `/v1/edit-shops/${encodeURIComponent(platform)}/filters`,
    { gender },
  );
}

/** 편집샵 상품 목록(추천순, cursor 페이지네이션). category 미지정 → 전체. */
export function getEditShopProducts(
  platform: string,
  opts: {
    gender: 'women' | 'men';
    category?: string;
    cursor?: string;
    limit?: number;
  },
): Promise<EditShopProductsResponse> {
  return api.get<EditShopProductsResponse>(
    `/v1/edit-shops/${encodeURIComponent(platform)}/products`,
    {
      gender: opts.gender,
      // 'all' 은 서버 기본값이라 보내지 않아도 되지만 명시적으로 전달.
      category: opts.category,
      cursor: opts.cursor,
      limit: opts.limit,
    },
  );
}
